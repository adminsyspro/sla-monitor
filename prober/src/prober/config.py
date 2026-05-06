from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, case_sensitive=False)

    prober_token: str
    next_internal_url: str = "http://web:3000"
    poll_interval_seconds: int = 5
    max_concurrent_checks: int = 50
    cleanup_interval_seconds: int = 3600
    log_level: str = "INFO"
