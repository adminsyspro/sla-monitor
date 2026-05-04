import time
import structlog
from prober.models import Monitor, CheckResult
from prober.probes.http import probe_http
from prober.probes.tcp import probe_tcp
from prober.probes.dns import probe_dns
from prober.probes.ssl import probe_ssl
from prober.probes.ping import probe_ping

log = structlog.get_logger()

# Map type names to module-level names so that unittest.mock.patch can
# replace the binding and the runner picks up the patched version at runtime.
_DISPATCH: dict[str, str] = {
    "http": "probe_http",
    "tcp": "probe_tcp",
    "dns": "probe_dns",
    "ssl": "probe_ssl",
    "ping": "probe_ping",
}

_globals = globals()


async def run_check(monitor: Monitor) -> CheckResult:
    fn_name = _DISPATCH.get(monitor.type)
    probe = _globals.get(fn_name) if fn_name else None
    if probe is None:
        log.warning("runner.unsupported_type", monitor_id=monitor.id, type=monitor.type)
        return CheckResult(
            monitor_id=monitor.id, timestamp=int(time.time()), status="major",
            error=f"unsupported monitor type: {monitor.type}",
        )
    try:
        return await probe(monitor)
    except Exception as e:  # noqa: BLE001 — last-resort catch
        log.exception("runner.probe_exception", monitor_id=monitor.id, type=monitor.type)
        return CheckResult(
            monitor_id=monitor.id, timestamp=int(time.time()), status="major",
            error=f"unhandled exception: {e}",
        )
