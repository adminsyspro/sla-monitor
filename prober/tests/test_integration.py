import asyncio
import json
import pytest
import respx
import httpx
from prober.client import NextApiClient
from prober.reporter import Reporter
from prober.scheduler import Scheduler


@pytest.mark.asyncio
@respx.mock
async def test_full_cycle_with_mock_next():
    """One poll → one HTTP probe → one POST /checks received by mock."""
    respx.get("http://next.test/api/internal/monitors-due").mock(
        side_effect=[
            httpx.Response(200, json={"monitors": [{
                "id": "m1", "type": "http",
                "url": "http://next.test/probed",
                "timeout_ms": 2000, "config": {"expected_status_code": 200}
            }]}),
            httpx.Response(200, json={"monitors": []}),
            httpx.Response(200, json={"monitors": []}),
        ]
    )
    respx.get("http://next.test/probed").mock(return_value=httpx.Response(200, text="ok"))
    posts = respx.post("http://next.test/api/internal/checks").mock(
        return_value=httpx.Response(201))

    client = NextApiClient("http://next.test", "test-token")
    async with client:
        reporter = Reporter(client, base_backoff=0.01)
        scheduler = Scheduler(client=client, reporter=reporter,
                              poll_interval=0.05, max_concurrent=10)
        task = asyncio.create_task(scheduler.run())
        await asyncio.sleep(0.3)
        scheduler.stop()
        await asyncio.wait_for(task, timeout=2.0)

    assert posts.called
    body = json.loads(posts.calls.last.request.content)
    assert body["monitor_id"] == "m1"
    assert body["status"] == "operational"
    assert body["status_code"] == 200
    assert body["region"] == "local"
