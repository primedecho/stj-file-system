"""Application settings loaded from environment variables and `.env` files."""

from enum import StrEnum

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "STJ File System API"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    database_url: str = Field(
        default="sqlite:///./stj_file_system.db",
        description="SQLAlchemy database connection URL",
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        description="Allowed CORS origins for the frontend",
    )

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    @property
    def should_seed_database(self) -> bool:
        """Seed demo data only in development when debug mode is enabled."""
        return self.is_development and self.debug


settings = Settings()
