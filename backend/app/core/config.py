from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Настройки приложения из переменных окружения (.env).

    Все поля без значения по умолчанию обязательны.
    Приложение не запустится, если они не заданы в .env.
    """
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int

    # Безопасность: SECRET_KEY ОБЯЗАТЕЛЕН — не имеет дефолта.
    # Генерировать: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SQL_ECHO: bool = False

    # CORS: список разрешённых источников через запятую. ОБЯЗАТЕЛЬНОЕ поле.
    # Например: "http://localhost:8090,https://overtime.company.kz"
    # ⚠️ НЕ используйте "*" в продакшне.
    ALLOWED_ORIGINS: str
    FRONTEND_BASE_URL: str = "http://localhost:8090"
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "strict"
    DEFAULT_TIMEZONE: str = "Asia/Almaty"

    # Telegram
    TELEGRAM_BOT_TOKEN: str | None = None

    # MS Graph Settings
    MS_CLIENT_ID: str | None = None
    MS_CLIENT_SECRET: str | None = None
    MS_TENANT_ID: str | None = None
    MS_SENDER_EMAIL: str | None = None

    # Odoo CRM Integration Settings
    # Документация: https://www.odoo.com/documentation/16.0/developer/api/external_api.html
    ODOO_URL: str | None = None       # Например: https://crm.company.kz
    ODOO_DB: str | None = None        # Название базы данных Odoo
    ODOO_USER: str | None = None      # Email пользователя Odoo
    ODOO_PASSWORD: str | None = None  # Пароль пользователя Odoo

    # Authentik OIDC Integration
    AUTHENTIK_BASE_URL: str | None = None
    AUTHENTIK_CLIENT_ID: str | None = None
    AUTHENTIK_CLIENT_SECRET: str | None = None
    AUTHENTIK_REDIRECT_URI: str | None = None

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

    @property
    def allowed_origins_list(self) -> list[str]:
        """Возвращает список CORS-origins из строки с разделителем ','."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def tz_info(self):
        """Возвращает объект временной зоны на основе DEFAULT_TIMEZONE."""
        from zoneinfo import ZoneInfo
        return ZoneInfo(self.DEFAULT_TIMEZONE)


settings = Settings()

