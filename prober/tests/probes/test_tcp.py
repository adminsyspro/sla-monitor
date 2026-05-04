import asyncio
import pytest
from prober.probes.tcp import probe_tcp
from prober.models import Monitor


def make(host: str, port: int, timeout_ms: int = 1000) -> Monitor:
    return Monitor(id="m1", type="tcp", url=host, timeout_ms=timeout_ms, config={"port": port})


@pytest.fixture
async def tcp_server():
    server = await asyncio.start_server(lambda r, w: None, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield port
    server.close()
    await server.wait_closed()


@pytest.mark.asyncio
async def test_operational_when_port_open(tcp_server):
    monitor = make("127.0.0.1", tcp_server)
    r = await probe_tcp(monitor)
    assert r.status == "operational"
    assert r.response_time_ms is not None


@pytest.mark.asyncio
async def test_major_when_port_closed():
    monitor = make("127.0.0.1", 1, timeout_ms=500)
    r = await probe_tcp(monitor)
    assert r.status == "major"
    assert r.error is not None


@pytest.mark.asyncio
async def test_major_on_timeout():
    monitor = make("10.255.255.1", 80, timeout_ms=200)
    r = await probe_tcp(monitor)
    assert r.status == "major"
    assert r.error and "timeout" in r.error.lower()


@pytest.mark.asyncio
async def test_missing_port_is_major():
    monitor = Monitor(id="m1", type="tcp", url="example.com", timeout_ms=500, config={})
    r = await probe_tcp(monitor)
    assert r.status == "major"
    assert r.error and "port" in r.error.lower()
