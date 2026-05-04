import asyncio
import time
from prober.models import Monitor, CheckResult


async def probe_tcp(monitor: Monitor) -> CheckResult:
    now_ts = int(time.time())
    port = monitor.config.get("port")
    if not isinstance(port, int):
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error="missing or invalid port in config",
        )

    timeout_s = monitor.timeout_ms / 1000.0
    started = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(monitor.url, port), timeout=timeout_s
        )
        elapsed_ms = int((time.monotonic() - started) * 1000)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="operational",
            response_time_ms=elapsed_ms,
        )
    except asyncio.TimeoutError:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error="timeout", response_time_ms=monitor.timeout_ms,
        )
    except (ConnectionRefusedError, OSError) as e:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error=str(e),
        )
