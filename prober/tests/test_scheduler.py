import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from prober.scheduler import Scheduler
from prober.models import Monitor, CheckResult


@pytest.fixture
def fake_check_result():
    return CheckResult(monitor_id="m1", timestamp=1, status="operational")


@pytest.mark.asyncio
async def test_polls_and_runs(fake_check_result):
    monitors = [Monitor(id="m1", type="http", url="https://x", timeout_ms=1000)]
    client = AsyncMock()
    client.get_monitors_due.return_value = monitors
    reporter = AsyncMock()
    reporter.send.return_value = True

    with patch("prober.scheduler.run_check", new=AsyncMock(return_value=fake_check_result)) as run_mock:
        sched = Scheduler(client=client, reporter=reporter, poll_interval=0.05, max_concurrent=10)
        task = asyncio.create_task(sched.run())
        await asyncio.sleep(0.15)
        sched.stop()
        await asyncio.wait_for(task, timeout=2.0)

    assert run_mock.await_count >= 1
    assert reporter.send.await_count >= 1


@pytest.mark.asyncio
async def test_bounds_concurrency():
    """When N monitors come in but max_concurrent=2, at most 2 probes run at once."""
    in_flight = 0
    peak = 0

    async def slow_probe(monitor):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.05)
        in_flight -= 1
        return CheckResult(monitor_id=monitor.id, timestamp=1, status="operational")

    monitors = [Monitor(id=f"m{i}", type="http", url="x", timeout_ms=1000) for i in range(6)]
    client = AsyncMock()
    client.get_monitors_due.side_effect = [monitors] + [[]] * 100
    reporter = AsyncMock()
    reporter.send.return_value = True

    with patch("prober.scheduler.run_check", new=AsyncMock(side_effect=slow_probe)):
        sched = Scheduler(client=client, reporter=reporter, poll_interval=10.0, max_concurrent=2)
        task = asyncio.create_task(sched.run())
        await asyncio.sleep(0.3)
        sched.stop()
        await asyncio.wait_for(task, timeout=2.0)

    assert peak <= 2


@pytest.mark.asyncio
async def test_continues_when_client_fails():
    """A failing get_monitors_due should not stop the loop."""
    client = AsyncMock()
    client.get_monitors_due.side_effect = [Exception("network down"), [], [], []]
    reporter = AsyncMock()

    sched = Scheduler(client=client, reporter=reporter, poll_interval=0.05, max_concurrent=10)
    task = asyncio.create_task(sched.run())
    await asyncio.sleep(0.2)
    sched.stop()
    await asyncio.wait_for(task, timeout=2.0)

    assert client.get_monitors_due.await_count >= 2


@pytest.mark.asyncio
async def test_updates_last_poll_at():
    client = AsyncMock()
    client.get_monitors_due.return_value = []
    reporter = AsyncMock()
    sched = Scheduler(client=client, reporter=reporter, poll_interval=0.05, max_concurrent=10)
    assert sched.last_poll_at is None
    task = asyncio.create_task(sched.run())
    await asyncio.sleep(0.1)
    sched.stop()
    await asyncio.wait_for(task, timeout=2.0)
    assert sched.last_poll_at is not None
