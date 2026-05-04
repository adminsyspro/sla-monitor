import asyncio
import time
from typing import Optional
import structlog
from prober.client import NextApiClient
from prober.reporter import Reporter
from prober.runner import run_check
from prober.models import Monitor

log = structlog.get_logger()


class Scheduler:
    def __init__(self, client: NextApiClient, reporter: Reporter,
                 poll_interval: float, max_concurrent: int):
        self._client = client
        self._reporter = reporter
        self._poll_interval = poll_interval
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._stopping = asyncio.Event()
        self._inflight: set[asyncio.Task] = set()
        self.last_poll_at: Optional[int] = None

    def stop(self) -> None:
        self._stopping.set()

    async def run(self) -> None:
        log.info("scheduler.start", poll_interval=self._poll_interval)
        while not self._stopping.is_set():
            try:
                monitors = await self._client.get_monitors_due()
                self.last_poll_at = int(time.time())
                log.info("poll.tick", monitors_due=len(monitors))
                for monitor in monitors:
                    self._spawn_check(monitor)
            except Exception as e:  # noqa: BLE001
                log.warning("poll.error", error=str(e))
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=self._poll_interval)
            except asyncio.TimeoutError:
                pass
        log.info("scheduler.stopping", inflight=len(self._inflight))
        if self._inflight:
            await asyncio.wait(self._inflight, timeout=30)
        log.info("scheduler.stopped")

    def _spawn_check(self, monitor: Monitor) -> None:
        task = asyncio.create_task(self._run_one(monitor))
        self._inflight.add(task)
        task.add_done_callback(self._inflight.discard)

    async def _run_one(self, monitor: Monitor) -> None:
        async with self._semaphore:
            result = await run_check(monitor)
        await self._reporter.send(result)
