import pytest
from prober.config import Settings


def test_requires_prober_token(monkeypatch):
    monkeypatch.setenv("NEXT_INTERNAL_URL", "http://web:3000")
    with pytest.raises(Exception):
        Settings()


def test_loads_defaults_when_token_set(monkeypatch):
    monkeypatch.setenv("PROBER_TOKEN", "abc123")
    s = Settings()
    assert s.prober_token == "abc123"
    assert s.next_internal_url == "http://web:3000"
    assert s.poll_interval_seconds == 5
    assert s.max_concurrent_checks == 50
    assert s.log_level == "INFO"


def test_respects_overrides(monkeypatch):
    monkeypatch.setenv("PROBER_TOKEN", "x")
    monkeypatch.setenv("NEXT_INTERNAL_URL", "http://localhost:3000")
    monkeypatch.setenv("POLL_INTERVAL_SECONDS", "10")
    monkeypatch.setenv("MAX_CONCURRENT_CHECKS", "100")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    s = Settings()
    assert s.next_internal_url == "http://localhost:3000"
    assert s.poll_interval_seconds == 10
    assert s.max_concurrent_checks == 100
    assert s.log_level == "DEBUG"
