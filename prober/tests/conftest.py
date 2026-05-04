import pytest

@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Clear PROBER-related env vars before each test for isolation."""
    for key in ['PROBER_TOKEN', 'NEXT_INTERNAL_URL', 'POLL_INTERVAL_SECONDS',
                'MAX_CONCURRENT_CHECKS', 'LOG_LEVEL']:
        monkeypatch.delenv(key, raising=False)
