import asyncio
import datetime
import socket
import ssl
import time
from urllib.parse import urlparse
from prober.models import Monitor, CheckResult


def _parse_host_port(url: str) -> tuple[str, int]:
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    host = parsed.hostname or url
    port = parsed.port or 443
    return host, port


def _fetch_cert(host: str, port: int, timeout_s: float) -> dict:
    """Synchronous cert fetch — runs in a thread to keep async."""
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout_s) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            cert = ssock.getpeercert()
    if not cert:
        raise ConnectionError("no peer cert")
    return cert


async def probe_ssl(monitor: Monitor) -> CheckResult:
    now_ts = int(time.time())
    timeout_s = monitor.timeout_ms / 1000.0
    warning_days = int(monitor.config.get("expiry_warning_days", 14))

    host, port = _parse_host_port(monitor.url)
    started = time.monotonic()
    try:
        cert = await asyncio.to_thread(_fetch_cert, host, port, timeout_s)
        elapsed_ms = int((time.monotonic() - started) * 1000)

        not_after_str = cert.get("notAfter", "")
        not_after = datetime.datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y GMT")
        now = datetime.datetime.utcnow()
        days_left = (not_after - now).total_seconds() / 86400.0
        expires_at_ts = int(not_after.replace(tzinfo=datetime.timezone.utc).timestamp())
        meta = {"ssl_expires_at": expires_at_ts, "days_until_expiry": int(days_left)}

        if days_left <= 0:
            return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                               error="certificate expired", response_time_ms=elapsed_ms,
                               metadata=meta)
        if days_left <= warning_days:
            return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="degraded",
                               response_time_ms=elapsed_ms, metadata=meta)
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="operational",
                           response_time_ms=elapsed_ms, metadata=meta)
    except (socket.timeout, asyncio.TimeoutError):
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error="timeout", response_time_ms=monitor.timeout_ms)
    except (ssl.SSLError, ConnectionError, OSError) as e:
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error=f"handshake failed: {e}")
