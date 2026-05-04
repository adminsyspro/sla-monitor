import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from prober.probes.ping import probe_ping
from prober.models import Monitor


def make(host: str, timeout_ms: int = 2000) -> Monitor:
    return Monitor(id="m1", type="ping", url=host, timeout_ms=timeout_ms, config={})


@pytest.mark.asyncio
async def test_operational_when_host_alive():
    fake_host = MagicMock()
    fake_host.is_alive = True
    fake_host.avg_rtt = 23.5
    with patch("prober.probes.ping.async_ping", new=AsyncMock(return_value=fake_host)):
        r = await probe_ping(make("1.1.1.1"))
    assert r.status == "operational"
    assert r.response_time_ms == 23


@pytest.mark.asyncio
async def test_major_when_host_unreachable():
    fake_host = MagicMock()
    fake_host.is_alive = False
    fake_host.avg_rtt = 0
    with patch("prober.probes.ping.async_ping", new=AsyncMock(return_value=fake_host)):
        r = await probe_ping(make("10.255.255.1"))
    assert r.status == "major"
    assert r.error and "unreachable" in r.error.lower()


@pytest.mark.asyncio
async def test_major_on_permission_error():
    with patch("prober.probes.ping.async_ping",
               new=AsyncMock(side_effect=PermissionError("operation not permitted"))):
        r = await probe_ping(make("1.1.1.1"))
    assert r.status == "major"
    assert r.error and "permission" in r.error.lower()


@pytest.mark.asyncio
async def test_major_on_generic_error():
    with patch("prober.probes.ping.async_ping",
               new=AsyncMock(side_effect=OSError("Network unreachable"))):
        r = await probe_ping(make("bogus.invalid"))
    assert r.status == "major"
    assert r.error and "network" in r.error.lower()
