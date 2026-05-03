"""Configurações centralizadas, lidas de variáveis de ambiente."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings da aplicação. Carregadas do ambiente."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # --- Postgres ---
    postgres_host: str = Field(default="postgres")
    postgres_port: int = Field(default=5432)
    postgres_db: str = Field(default="intelliforce")
    postgres_user: str = Field(default="intelliforce")
    postgres_password: str = Field(default="change-me")

    @property
    def database_url(self) -> str:
        """URL pra SQLAlchemy async (asyncpg)."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        """URL pra Alembic (psycopg2/sync)."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # --- ClickHouse ---
    clickhouse_host: str = Field(default="clickhouse")
    clickhouse_port: int = Field(default=9000)
    clickhouse_http_port: int = Field(default=8123)
    clickhouse_db: str = Field(default="intelliforce_audit")
    clickhouse_user: str = Field(default="intelliforce")
    clickhouse_password: str = Field(default="change-me")

    # --- Redis ---
    redis_host: str = Field(default="redis")
    redis_port: int = Field(default=6379)
    redis_db: int = Field(default=0)
    redis_url: str = Field(default="redis://redis:6379/0")

    # --- LM Studio ---
    lmstudio_base_url: str = Field(default="http://host.docker.internal:1234/v1")
    lmstudio_api_key: str = Field(default="")
    lmstudio_default_model: str = Field(default="qwen/qwen3.6-27b")
    lmstudio_max_tokens: int = Field(default=8192)
    lmstudio_context_length: int = Field(default=32768)

    # --- OpenCode ---
    opencode_config_path: str = Field(default="/opencode-runtime")
    opencode_timeout_seconds: int = Field(default=300)

    # --- Auth ---
    jwt_secret: str = Field(default="change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_expire_minutes: int = Field(default=60)
    jwt_refresh_token_expire_days: int = Field(default=7)

    # --- Admin inicial ---
    admin_email: str = Field(default="admin@arctica.com.br")
    admin_password: str = Field(default="")

    # --- CORS ---
    allowed_origins: str = Field(default="http://localhost:3000")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    # --- Worker ---
    worker_concurrency: int = Field(default=3)
    worker_poll_interval_seconds: int = Field(default=1)


@lru_cache
def get_settings() -> Settings:
    """Singleton — settings só são lidos uma vez."""
    return Settings()
