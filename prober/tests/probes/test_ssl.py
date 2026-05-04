import pytest
from unittest.mock import patch
from prober.probes.ssl import probe_ssl, _parse_host_port
from prober.models import Monitor


def make(url: str, warning_days: int = 14, timeout_ms: int = 5000) -> Monitor:
    return Monitor(id="m1", type="ssl", url=url, timeout_ms=timeout_ms,
                   config={"expiry_warning_days": warning_days})


def test_parse_host_port_with_scheme():
    assert _parse_host_port("https://example.com") == ("example.com", 443)
    assert _parse_host_port("https://example.com:8443") == ("example.com", 8443)
    assert _parse_host_port("example.com") == ("example.com", 443)


@pytest.mark.asyncio
async def test_operational_when_far_from_expiry():
    fake_cert = {"notAfter": "Dec 31 23:59:59 2099 GMT"}
    with patch("prober.probes.ssl._fetch_cert", return_value=fake_cert):
        r = await probe_ssl(make("https://example.com"))
    assert r.status == "operational"
    assert r.metadata.get("ssl_expires_at") is not None


@pytest.mark.asyncio
async def test_degraded_within_warning_window():
    import datetime
    near = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).strftime("%b %d %H:%M:%S %Y GMT")
    fake_cert = {"notAfter": near}
    with patch("prober.probes.ssl._fetch_cert", return_value=fake_cert):
        r = await probe_ssl(make("https://example.com", warning_days=14))
    assert r.status == "degraded"


@pytest.mark.asyncio
async def test_major_when_expired():
    fake_cert = {"notAfter": "Jan 01 00:00:00 2000 GMT"}
    with patch("prober.probes.ssl._fetch_cert", return_value=fake_cert):
        r = await probe_ssl(make("https://example.com"))
    assert r.status == "major"
    assert r.error and "expired" in r.error.lower()


@pytest.mark.asyncio
async def test_major_on_handshake_failure():
    with patch("prober.probes.ssl._fetch_cert", side_effect=ConnectionError("handshake failed")):
        r = await probe_ssl(make("https://broken.example.com"))
    assert r.status == "major"
    assert r.error and "handshake" in r.error.lower()
