import json
import pytest
import httpx
import respx
from prober.client import NextApiClient
from prober.models import CheckResult


@pytest.fixture
def client():
    return NextApiClient(base_url="http://next.test", token="abc")


@pytest.mark.asyncio
@respx.mock
async def test_get_monitors_due_returns_parsed_monitors(client):
    respx.get("http://next.test/api/internal/monitors-due").mock(
        return_value=httpx.Response(200, json={"monitors": [
            {"id": "m1", "type": "http", "url": "https://x", "timeout_ms": 5000,
             "config": {"expected_status_code": 200}}
        ]})
    )
    async with client:
        result = await client.get_monitors_due()
    assert len(result) == 1
    assert result[0].id == "m1"
    assert result[0].config == {"expected_status_code": 200}


@pytest.mark.asyncio
@respx.mock
async def test_get_monitors_due_passes_limit(client):
    route = respx.get("http://next.test/api/internal/monitors-due", params={"limit": "200"}).mock(
        return_value=httpx.Response(200, json={"monitors": []})
    )
    async with client:
        await client.get_monitors_due(limit=200)
    assert route.called


@pytest.mark.asyncio
@respx.mock
async def test_get_monitors_due_sends_bearer(client):
    route = respx.get("http://next.test/api/internal/monitors-due").mock(
        return_value=httpx.Response(200, json={"monitors": []})
    )
    async with client:
        await client.get_monitors_due()
    assert route.calls.last.request.headers["authorization"] == "Bearer abc"


@pytest.mark.asyncio
@respx.mock
async def test_post_check_sends_payload(client):
    route = respx.post("http://next.test/api/internal/checks").mock(
        return_value=httpx.Response(201)
    )
    result = CheckResult(
        monitor_id="m1", timestamp=1714831200, status="operational",
        response_time_ms=142, status_code=200,
    )
    async with client:
        await client.post_check(result)
    payload = json.loads(route.calls.last.request.content)
    assert payload["monitor_id"] == "m1"
    assert payload["status"] == "operational"
    assert payload["region"] == "local"
    assert payload["metadata"] == {}


@pytest.mark.asyncio
@respx.mock
async def test_post_check_raises_on_5xx(client):
    respx.post("http://next.test/api/internal/checks").mock(
        return_value=httpx.Response(500)
    )
    async with client:
        with pytest.raises(httpx.HTTPStatusError):
            await client.post_check(CheckResult(monitor_id="m1", timestamp=1, status="major"))


@pytest.mark.asyncio
@respx.mock
async def test_post_check_410_returns_true(client):
    respx.post("http://next.test/api/internal/checks").mock(
        return_value=httpx.Response(410)
    )
    async with client:
        gone = await client.post_check(CheckResult(monitor_id="m1", timestamp=1, status="major"))
    assert gone is True


@pytest.mark.asyncio
@respx.mock
async def test_post_check_201_returns_false(client):
    respx.post("http://next.test/api/internal/checks").mock(
        return_value=httpx.Response(201)
    )
    async with client:
        gone = await client.post_check(CheckResult(monitor_id="m1", timestamp=1, status="operational"))
    assert gone is False
