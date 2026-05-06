import asyncio
from typing import Protocol
import structlog

log = structlog.get_logger()


class CleanupClient(Protocol):
    async def post_cleanup(self) -> dict: ...


class CleanupLoop:
    """Periodically triggers /api/internal/cleanup on Next.

    Runs one tick on entry, then waits `interval` seconds between ticks.
    Errors are logged and swallowed so the loop survives transient failures.
    """

    def __init__(self, client: CleanupClient, interval: float):
        self._client = client
        self._interval = interval
        self._stopping = asyncio.Event()

    def stop(self) -> None:
        self._stopping.set()

    async def run(self) -> None:
        log.info("cleanup.start", interval=self._interval)
        while not self._stopping.is_set():
            try:
                resp = await self._client.post_cleanup()
                log.info(
                    "cleanup.tick",
                    deleted=resp.get("deleted"),
                    retention_days=resp.get("retention_days"),
                    skipped=resp.get("skipped"),
                )
            except Exception as e:  # noqa: BLE001
                log.warning("cleanup.error", error=str(e))
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                pass
        log.info("cleanup.stopped")
