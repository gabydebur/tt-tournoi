from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/tt_tournoi"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "changeme-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    # Default admin bootstrap (created on first startup if not existing)
    SEED_ADMIN_ENABLED: bool = True
    SEED_ADMIN_EMAIL: str = "admin@admin.com"
    SEED_ADMIN_PASSWORD: str = "admin"


settings = Settings()
