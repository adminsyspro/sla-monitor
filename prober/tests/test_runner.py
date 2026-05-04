import pytest
from unittest.mock import AsyncMock, patch
from prober.runner import run_check
from prober.models import Monitor, CheckResult


@pytest.mark.asyncio
async def test_dispatches_http():
    monitor = Monitor(id="m1", type="http", url="https://x", timeout_ms=1000, config={})
    fake = CheckResult(monitor_id="m1", timestamp=1, status="operational")
    with patch("prober.runner.probe_http", new=AsyncMock(return_value=fake)) as m:
        r = await run_check(monitor)
    assert m.called
    assert r is fake


@pytest.mark.asyncio
async def test_dispatches_tcp():
    monitor = Monitor(id="m1", type="tcp", url="x", timeout_ms=1000, config={"port": 80})
    fake = CheckResult(monitor_id="m1", timestamp=1, status="operational")
    with patch("prober.runner.probe_tcp", new=AsyncMock(return_value=fake)) as m:
        r = await run_check(monitor)
    assert m.called
    assert r is fake


@pytest.mark.asyncio
async def test_dispatches_dns():
    monitor = Monitor(id="m1", type="dns", url="example.com", timeout_ms=1000, config={})
    fake = CheckResult(monitor_id="m1", timestamp=1, status="operational")
    with patch("prober.runner.probe_dns", new=AsyncMock(return_value=fake)) as m:
        r = await run_check(monitor)
    assert m.called
    assert r is fake


@pytest.mark.asyncio
async def test_dispatches_ssl():
    monitor = Monitor(id="m1", type="ssl", url="https://x", timeout_ms=1000, config={})
    fake = CheckResult(monitor_id="m1", timestamp=1, status="operational")
    with patch("prober.runner.probe_ssl", new=AsyncMock(return_value=fake)) as m:
        r = await run_check(monitor)
    assert m.called
    assert r is fake


@pytest.mark.asyncio
async def test_dispatches_ping():
    monitor = Monitor(id="m1", type="ping", url="1.1.1.1", timeout_ms=1000, config={})
    fake = CheckResult(monitor_id="m1", timestamp=1, status="operational")
    with patch("prober.runner.probe_ping", new=AsyncMock(return_value=fake)) as m:
        r = await run_check(monitor)
    assert m.called
    assert r is fake


@pytest.mark.asyncio
async def test_unknown_type_returns_major():
    monitor = Monitor(id="m1", type="bogus", url="x", timeout_ms=1000, config={})  # type: ignore[arg-type]
    r = await run_check(monitor)
    assert r.status == "major"
    assert r.error and "unsupported" in r.error.lower()


@pytest.mark.asyncio
async def test_exception_in_probe_is_captured():
    monitor = Monitor(id="m1", type="http", url="https://x", timeout_ms=1000, config={})
    with patch("prober.runner.probe_http", new=AsyncMock(side_effect=RuntimeError("boom"))):
        r = await run_check(monitor)
    assert r.status == "major"
    assert r.error and "boom" in r.error
