import asyncio
import structlog
import httpx
from prober.client import NextApiClient
from prober.models import CheckResult

log = structlog.get_logger()


class Reporter:
    """Wraps NextApiClient.post_check with retry logic.

    Retries on 5xx and connection errors (exponential backoff: base, base*2, base*4).
    Does NOT retry on 4xx (other than 410, which is treated as a non-error drop).
    On 401, exits the process — token misconfiguration should be loud.
    """

    def __init__(self, client: NextApiClient, max_retries: int = 3, base_backoff: float = 1.0):
        self._client = client
        self._max_retries = max_retries
        self._base_backoff = base_backoff

    async def send(self, result: CheckResult) -> bool:
        """Returns True if accepted (or marked gone), False if dropped after retries."""
        for attempt in range(self._max_retries):
            try:
                await self._client.post_check(result)
                return True
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                if status == 401:
                    log.error("reporter.unauthorized", monitor_id=result.monitor_id)
                    raise SystemExit(1)
                if 400 <= status < 500:
                    log.warning("reporter.client_error", status=status,
                                monitor_id=result.monitor_id)
                    return False
                log.warning("reporter.server_error", status=status, attempt=attempt + 1,
                            monitor_id=result.monitor_id)
            except httpx.TransportError as e:
                log.warning("reporter.network_error", error=str(e), attempt=attempt + 1,
                            monitor_id=result.monitor_id)
            if attempt < self._max_retries - 1:
                await asyncio.sleep(self._base_backoff * (2 ** attempt))
        log.error("reporter.dropped_after_retries", monitor_id=result.monitor_id)
        return False
