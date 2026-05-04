import time
import dns.asyncresolver
import dns.exception
import dns.resolver
from prober.models import Monitor, CheckResult


async def probe_dns(monitor: Monitor) -> CheckResult:
    now_ts = int(time.time())
    timeout_s = monitor.timeout_ms / 1000.0
    started = time.monotonic()
    resolver = dns.asyncresolver.Resolver()
    resolver.timeout = timeout_s
    resolver.lifetime = timeout_s
    try:
        answer = await resolver.resolve(monitor.url, "A")
        elapsed_ms = int((time.monotonic() - started) * 1000)
        records = [r.to_text() for r in answer]
        return CheckResult(
            monitor_id=monitor.id, timestamp=now_ts, status="operational",
            response_time_ms=elapsed_ms, metadata={"records": records},
        )
    except dns.resolver.NXDOMAIN:
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error="NXDOMAIN")
    except dns.resolver.NoAnswer:
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error="no answer")
    except dns.exception.Timeout:
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error="timeout", response_time_ms=monitor.timeout_ms)
    except dns.exception.DNSException as e:
        return CheckResult(monitor_id=monitor.id, timestamp=now_ts, status="major",
                           error=str(e))
