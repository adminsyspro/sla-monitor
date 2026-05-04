import time
import httpx
from prober.models import Monitor, CheckResult

DEGRADED_THRESHOLD_MS = 5000


async def probe_http(monitor: Monitor) -> CheckResult:
    expected = monitor.config.get("expected_status_code")
    timeout_s = monitor.timeout_ms / 1000.0
    started = time.monotonic()
    now_ts = int(time.time())

    try:
        async with httpx.AsyncClient(timeout=timeout_s, follow_redirects=True) as client:
            resp = await client.get(monitor.url)
        elapsed_ms = int((time.monotonic() - started) * 1000)

        ok = (resp.status_code == expected) if expected else (200 <= resp.status_code < 300)
        if not ok:
            err_msg = f"expected {expected}, got {resp.status_code}" if expected else f"non-2xx ({resp.status_code})"
            return CheckResult(
                monitor_id=monitor.id, timestamp=now_ts, status="major",
                response_time_ms=elapsed_ms, status_code=resp.status_code, error=err_msg,
            )
        status = "degraded" if elapsed_ms > DEGRADED_THRESHOLD_MS else "operational"
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status=status,
            response_time_ms=elapsed_ms, status_code=resp.status_code,
        )
    except httpx.TimeoutException:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major",
            error="timeout", response_time_ms=monitor.timeout_ms,
        )
    except httpx.HTTPError as e:
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="major", error=str(e),
        )
