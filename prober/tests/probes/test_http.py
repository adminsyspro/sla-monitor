import pytest
from prober.probes.http import probe_http
from prober.models import Monitor


def make(url: str, expected: int | None = None, timeout_ms: int = 5000) -> Monitor:
    cfg = {"expected_status_code": expected} if expected is not None else {}
    return Monitor(id="m1", type="http", url=url, timeout_ms=timeout_ms, config=cfg)


@pytest.mark.asyncio
async def test_operational_on_expected_status(httpserver):
    httpserver.expect_request("/health").respond_with_data("ok", status=200)
    monitor = make(httpserver.url_for("/health"), expected=200)
    r = await probe_http(monitor)
    assert r.status == "operational"
    assert r.status_code == 200
    assert r.response_time_ms is not None and r.response_time_ms >= 0
    assert r.error is None


@pytest.mark.asyncio
async def test_operational_on_2xx_when_no_expected(httpserver):
    httpserver.expect_request("/").respond_with_data("ok", status=204)
    monitor = make(httpserver.url_for("/"))
    r = await probe_http(monitor)
    assert r.status == "operational"


@pytest.mark.asyncio
async def test_major_on_status_mismatch(httpserver):
    httpserver.expect_request("/").respond_with_data("err", status=500)
    monitor = make(httpserver.url_for("/"), expected=200)
    r = await probe_http(monitor)
    assert r.status == "major"
    assert r.status_code == 500
    assert r.error and "expected 200" in r.error


@pytest.mark.asyncio
async def test_major_on_connect_refused():
    monitor = make("http://127.0.0.1:1", timeout_ms=500)
    r = await probe_http(monitor)
    assert r.status == "major"
    assert r.error is not None


@pytest.mark.asyncio
async def test_major_on_timeout(httpserver):
    import time
    def slow(_request):
        time.sleep(0.5)
        from werkzeug.wrappers import Response
        return Response("late", status=200)
    httpserver.expect_request("/slow").respond_with_handler(slow)
    monitor = make(httpserver.url_for("/slow"), timeout_ms=100)
    r = await probe_http(monitor)
    assert r.status == "major"
    assert r.error and "timeout" in r.error.lower()
