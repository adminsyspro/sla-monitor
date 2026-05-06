import asyncio
import pytest
from prober.cleanup import CleanupLoop


class FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def post_cleanup(self) -> dict:
        self.calls += 1
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.mark.asyncio
async def test_cleanup_loop_calls_post_cleanup_each_tick():
    client = FakeClient([
        {"deleted": 5, "retention_days": 30},
        {"deleted": 0, "retention_days": 30},
    ])
    loop = CleanupLoop(client=client, interval=0.05)
    task = asyncio.create_task(loop.run())
    await asyncio.sleep(0.18)
    loop.stop()
    await task
    assert client.calls >= 2


@pytest.mark.asyncio
async def test_cleanup_loop_survives_http_errors():
    client = FakeClient([
        RuntimeError("boom"),
        {"deleted": 1, "retention_days": 30},
    ])
    loop = CleanupLoop(client=client, interval=0.05)
    task = asyncio.create_task(loop.run())
    await asyncio.sleep(0.18)
    loop.stop()
    await task
    assert client.calls >= 2


@pytest.mark.asyncio
async def test_cleanup_loop_stops_on_signal():
    client = FakeClient([{"deleted": 0, "retention_days": None, "skipped": "unlimited"}])
    loop = CleanupLoop(client=client, interval=10.0)
    task = asyncio.create_task(loop.run())
    await asyncio.sleep(0.05)
    loop.stop()
    await asyncio.wait_for(task, timeout=1.0)
    assert client.calls == 1
