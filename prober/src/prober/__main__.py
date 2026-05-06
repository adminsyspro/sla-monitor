import asyncio
import signal
import sys
import logging
import structlog
from prober.config import Settings
from prober.client import NextApiClient
from prober.reporter import Reporter
from prober.scheduler import Scheduler
from prober.cleanup import CleanupLoop
from prober.health import run_health_server


def configure_logging(level: str) -> None:
    logging.basicConfig(level=getattr(logging, level.upper(), logging.INFO))
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )


async def main() -> int:
    try:
        settings = Settings()
    except Exception as e:
        print(f"FATAL: invalid configuration: {e}", file=sys.stderr)
        return 2

    configure_logging(settings.log_level)
    log = structlog.get_logger()
    log.info("prober.boot",
             next_url=settings.next_internal_url,
             poll_interval=settings.poll_interval_seconds,
             max_concurrent=settings.max_concurrent_checks)

    client = NextApiClient(settings.next_internal_url, settings.prober_token)
    async with client:
        reporter = Reporter(client)
        scheduler = Scheduler(
            client=client,
            reporter=reporter,
            poll_interval=settings.poll_interval_seconds,
            max_concurrent=settings.max_concurrent_checks,
        )
        cleanup = CleanupLoop(client=client, interval=settings.cleanup_interval_seconds)
        health_runner = await run_health_server(lambda: scheduler.last_poll_at)

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: (scheduler.stop(), cleanup.stop()))

        try:
            await asyncio.gather(scheduler.run(), cleanup.run())
        finally:
            await health_runner.cleanup()
    log.info("prober.exit")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
