from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    SECRET_KEY: str = "super-secret-key-123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Telegram
    TELEGRAM_BOT_TOKEN: str | None = None

    # MS Graph Settings
    MS_CLIENT_ID: str | None = None
    MS_CLIENT_SECRET: str | None = None
    MS_TENANT_ID: str | None = None
    MS_SENDER_EMAIL: str | None = None

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
