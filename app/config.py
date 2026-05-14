import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def load_environment() -> None:
    env_file = os.getenv("ENV_FILE")
    app_env = (os.getenv("APP_ENV") or os.getenv("ENV") or "").lower()

    if env_file:
        load_dotenv(env_file, override=False)
        return

    load_dotenv(".env", override=False)
    if app_env in {"prod", "production"}:
        load_dotenv(".env.prod", override=False)


load_environment()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./billingapp.db"
    SECRET_KEY: str = "dev-insecure-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_PUBLIC_URL: str | None = None
    CORS_ORIGINS: str | list[str] | None = None
    PORT: int = 8000
    UVICORN_WORKERS: int = 2

    @field_validator("APP_ENV", mode="before")
    @classmethod
    def normalize_env(cls, value: object) -> str:
        return str(value or "development").lower()

    @property
    def is_production(self) -> bool:
        return self.APP_ENV in {"prod", "production"}

    @property
    def cors_origins(self) -> list[str]:
        raw = self.CORS_ORIGINS or self.FRONTEND_URL
        if isinstance(raw, str):
            values = [origin.strip() for origin in raw.split(",") if origin.strip()]
        else:
            values = [str(origin).strip() for origin in raw if str(origin).strip()]
        return values or [self.FRONTEND_URL]

    def validate_production(self) -> None:
        if not self.is_production:
            return

        failures: list[str] = []
        if self.SECRET_KEY in {"", "dev-insecure-secret", "fallback-secret-for-session", "your-super-secret-key-change-in-production"}:
            failures.append("SECRET_KEY must be set to a strong production secret")
        if self.FRONTEND_URL.startswith("http://localhost") or self.FRONTEND_URL.startswith("http://127.0.0.1"):
            failures.append("FRONTEND_URL must point to the real frontend domain in production")
        if self.DATABASE_URL.startswith("sqlite:///"):
            failures.append("DATABASE_URL must point to a production Postgres database")
        if any(origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1") for origin in self.cors_origins):
            failures.append("CORS_ORIGINS must not be localhost in production")

        if failures:
            raise RuntimeError("Production configuration is invalid: " + "; ".join(failures))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production()
    return settings


settings = get_settings()
