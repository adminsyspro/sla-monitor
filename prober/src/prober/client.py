import dataclasses
from typing import Optional
import httpx
from prober.models import Monitor, CheckResult


class NextApiClient:
    def __init__(self, base_url: str, token: str, timeout: float = 10.0):
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "NextApiClient":
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"authorization": f"Bearer {self._token}"},
            timeout=self._timeout,
        )
        return self

    async def __aexit__(self, *exc) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_monitors_due(self, limit: int = 100) -> list[Monitor]:
        assert self._client is not None, "Use as async context manager"
        resp = await self._client.get("/api/internal/monitors-due", params={"limit": limit})
        resp.raise_for_status()
        body = resp.json()
        return [
            Monitor(id=m["id"], type=m["type"], url=m["url"],
                    timeout_ms=m["timeout_ms"], config=m.get("config", {}))
            for m in body.get("monitors", [])
        ]

    async def post_check(self, result: CheckResult) -> bool:
        """Returns True if the monitor was reported as gone (410), False on success.
        Raises httpx.HTTPStatusError for other failures."""
        assert self._client is not None, "Use as async context manager"
        payload = dataclasses.asdict(result)
        resp = await self._client.post("/api/internal/checks", json=payload)
        if resp.status_code == 410:
            return True
        resp.raise_for_status()
        return False

    async def post_cleanup(self) -> dict:
        """Trigger one cleanup tick on Next. Returns the parsed JSON response.
        Raises httpx.HTTPStatusError on non-2xx."""
        assert self._client is not None, "Use as async context manager"
        resp = await self._client.post("/api/internal/cleanup")
        resp.raise_for_status()
        return resp.json()
