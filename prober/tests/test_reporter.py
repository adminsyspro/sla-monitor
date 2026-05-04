import pytest
from unittest.mock import AsyncMock
import httpx
from prober.reporter import Reporter
from prober.models import CheckResult


@pytest.fixture
def result():
    return CheckResult(monitor_id="m1", timestamp=1, status="operational")


def http_error(status: int) -> httpx.HTTPStatusError:
    return httpx.HTTPStatusError("boom", request=AsyncMock(), response=httpx.Response(status))


@pytest.mark.asyncio
async def test_succeeds_on_first_try(result):
    client = AsyncMock()
    client.post_check.return_value = False
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    sent = await reporter.send(result)
    assert sent is True
    assert client.post_check.await_count == 1


@pytest.mark.asyncio
async def test_retries_on_5xx_then_succeeds(result):
    client = AsyncMock()
    client.post_check.side_effect = [http_error(500), http_error(500), False]
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    sent = await reporter.send(result)
    assert sent is True
    assert client.post_check.await_count == 3


@pytest.mark.asyncio
async def test_drops_after_max_retries(result):
    client = AsyncMock()
    client.post_check.side_effect = http_error(500)
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    sent = await reporter.send(result)
    assert sent is False
    assert client.post_check.await_count == 3


@pytest.mark.asyncio
async def test_does_not_retry_on_4xx(result):
    client = AsyncMock()
    client.post_check.side_effect = http_error(400)
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    sent = await reporter.send(result)
    assert sent is False
    assert client.post_check.await_count == 1


@pytest.mark.asyncio
async def test_handles_410_as_drop(result):
    client = AsyncMock()
    client.post_check.return_value = True
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    sent = await reporter.send(result)
    assert sent is True
    assert client.post_check.await_count == 1


@pytest.mark.asyncio
async def test_raises_on_401(result):
    client = AsyncMock()
    client.post_check.side_effect = http_error(401)
    reporter = Reporter(client, max_retries=3, base_backoff=0.01)
    with pytest.raises(SystemExit):
        await reporter.send(result)
