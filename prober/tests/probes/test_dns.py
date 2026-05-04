import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import dns.resolver
import dns.exception
from prober.probes.dns import probe_dns
from prober.models import Monitor


def make(name: str, timeout_ms: int = 2000) -> Monitor:
    return Monitor(id="m1", type="dns", url=name, timeout_ms=timeout_ms, config={})


@pytest.mark.asyncio
async def test_operational_returns_records():
    fake_answer = MagicMock()
    fake_answer.__iter__.return_value = iter([MagicMock(to_text=lambda: "1.2.3.4")])
    fake_resolver = MagicMock()
    fake_resolver.resolve = AsyncMock(return_value=fake_answer)
    with patch("prober.probes.dns.dns.asyncresolver.Resolver", return_value=fake_resolver):
        r = await probe_dns(make("example.com"))
    assert r.status == "operational"
    assert r.metadata.get("records") == ["1.2.3.4"]


@pytest.mark.asyncio
async def test_major_on_nxdomain():
    fake_resolver = MagicMock()
    fake_resolver.resolve = AsyncMock(side_effect=dns.resolver.NXDOMAIN())
    with patch("prober.probes.dns.dns.asyncresolver.Resolver", return_value=fake_resolver):
        r = await probe_dns(make("nx.example.invalid"))
    assert r.status == "major"
    assert "NXDOMAIN" in (r.error or "")


@pytest.mark.asyncio
async def test_major_on_timeout():
    fake_resolver = MagicMock()
    fake_resolver.resolve = AsyncMock(side_effect=dns.exception.Timeout())
    with patch("prober.probes.dns.dns.asyncresolver.Resolver", return_value=fake_resolver):
        r = await probe_dns(make("slow.example.com"))
    assert r.status == "major"
    assert r.error and "timeout" in r.error.lower()


@pytest.mark.asyncio
async def test_major_on_no_answer():
    fake_resolver = MagicMock()
    fake_resolver.resolve = AsyncMock(side_effect=dns.resolver.NoAnswer())
    with patch("prober.probes.dns.dns.asyncresolver.Resolver", return_value=fake_resolver):
        r = await probe_dns(make("example.com"))
    assert r.status == "major"
