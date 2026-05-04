import time
from icmplib import async_ping
from prober.models import Monitor, CheckResult


async def probe_ping(monitor: Monitor) -> CheckResult:
    now_ts = int(time.time())
    timeout_s = monitor.timeout_ms / 1000.0
    started = time.monotonic()
    try:
        host = await async_ping(
            monitor.url, count=1, timeout=timeout_s, privileged=False
        )
        elapsed_ms = int((time.monotonic() - started) * 1000)
        if host.is_alive:
            rtt = int(host.avg_rtt) if host.avg_rtt else elapsed_ms
            return CheckResult(
                monitor_id=monitor.id, timestamp=now_ts, status="operational",
                response_time_ms=rtt,
            )
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error="host unreachable", response_time_ms=elapsed_ms,
        )
    except PermissionError as e:
        # Raised when net.ipv4.ping_group_range disallows the current GID
        # and the process lacks CAP_NET_RAW. Surface a clear, actionable error.
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error=f"icmp permission denied (configure net.ipv4.ping_group_range or run with CAP_NET_RAW): {e}",
        )
    except Exception as e:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error=str(e),
        )
