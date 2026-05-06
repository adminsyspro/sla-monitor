import asyncio
import time
from urllib.parse import urlparse
from prober.models import Monitor, CheckResult


def _parse_target(url: str, configured_port: object) -> tuple[str | None, int | None]:
    raw_url = url.strip()
    if not raw_url:
        return None, None

    parsed = urlparse(raw_url if "://" in raw_url else f"//{raw_url}")
    host = parsed.hostname

    try:
        parsed_port = parsed.port
    except ValueError:
        parsed_port = None

    port = configured_port if isinstance(configured_port, int) else None
    if port is None:
        port = parsed_port

    if not host and ":" not in raw_url and "/" not in raw_url:
        host = raw_url

    if port is not None and not 1 <= port <= 65535:
        port = None

    return host, port


async def probe_tcp(monitor: Monitor) -> CheckResult:
    now_ts = int(time.time())
    host, port = _parse_target(monitor.url, monitor.config.get("port"))
    if not host or port is None:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error="missing or invalid TCP host/port",
        )

    timeout_s = monitor.timeout_ms / 1000.0
    started = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout_s
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
