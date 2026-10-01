"""
Модуль конфигурации приложения OvertimePro.

Загружает переменные окружения из .env файла и предоставляет типизированные настройки
с логической группировкой по подсистемам:
- DatabaseSettings: параметры подключения к PostgreSQL
- MSGraphSettings: интеграция с Microsoft Graph API (почта / OTP)
- OdooSettings: интеграция с Odoo CRM
- AuthentikSettings: корпоративный Single Sign-On (SSO)
"""

from zoneinfo import ZoneInfo

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


# ─────────────────────────────────────────────────────────────
# 1. Подсистема базы данных PostgreSQL
# ─────────────────────────────────────────────────────────────
class DatabaseSettings(BaseModel):
    """
    Параметры подключения к реляционной СУБД PostgreSQL.

    Attributes:
        user (str): Имя пользователя базы данных.
        password (str): Пароль пользователя базы данных.
        db (str): Имя целевой базы данных.
        host (str): Сетевой адрес хоста PostgreSQL.
        port (int): Сетевой порт PostgreSQL (по умолчанию 5432).
    """

    user: str
    password: str
    db: str
    host: str
    port: int = 5432


# ─────────────────────────────────────────────────────────────
# 2. Подсистема Microsoft Graph API (Office 365 / Azure AD)
# ─────────────────────────────────────────────────────────────
class MSGraphSettings(BaseModel):
    """
    Параметры интеграции с Microsoft Graph API.

    Используется для отправки одноразовых паролей 2FA (OTP) и системных почтовых уведомлений.

    Attributes:
        client_id (str | None): Application (Client) ID зарегистрированного приложения в Azure AD.
        client_secret (str | None): Client Secret для аутентификации приложения в Azure AD.
        tenant_id (str | None): Directory (Tenant) ID организации.
        sender_email (str | None): Корпоративный email-адрес отправителя (например, admin@example.com).
    """

    client_id: str | None = None
    client_secret: str | None = None
    tenant_id: str | None = None
    sender_email: str | None = None


# ─────────────────────────────────────────────────────────────
# 3. Подсистема интеграции с Odoo CRM
# ─────────────────────────────────────────────────────────────
class OdooSettings(BaseModel):
    """
    Параметры интеграции с Odoo CRM для импорта и синхронизации проектов.

    Attributes:
        url (str | None): Базовый URL инстанса Odoo (например: https://crm.company.kz).
        db (str | None): Имя рабочей базы данных Odoo.
        user (str | None): Логин (email) сервисного пользователя Odoo.
        password (str | None): Пароль сервисного пользователя Odoo.
        integration_url (str | None): Базовый URL микросервиса-коннектора к Odoo.
        integration_key (str | None): API-ключ авторизации в микросервисе-коннекторе.
    """

    url: str | None = None
    db: str | None = None
    user: str | None = None
    password: str | None = None
    integration_url: str | None = None
    integration_key: str | None = None


# ─────────────────────────────────────────────────────────────
# 4. Подсистема аутентификации Authentik (OIDC / SSO)
# ─────────────────────────────────────────────────────────────
class AuthentikSettings(BaseModel):
    """
    Параметры OIDC-провайдера Authentik для Single Sign-On (SSO).

    Attributes:
        base_url (str | None): Базовый URL инстанса Authentik (например: https://auth.company.kz).
        client_id (str | None): Client ID клиента OAuth2 в Authentik.
        client_secret (str | None): Client Secret клиента OAuth2 в Authentik.
        redirect_uri (str | None): Callback URL после завершения OIDC аутентификации.
        application_slug (str): Слаг приложения в Authentik (по умолчанию 'overtime').
    """

    base_url: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    redirect_uri: str | None = None
    application_slug: str = "overtime"


# ─────────────────────────────────────────────────────────────
# Главный класс настроек приложения
# ─────────────────────────────────────────────────────────────
class Settings(BaseSettings):
    """
    Главный контейнер конфигурации OvertimePro.

    Считывает переменные окружения и предоставляет доступ к настройкам:
    - Сгруппированным: settings.db, settings.ms_graph, settings.odoo, settings.authentik
    - Плоским (для полной обратной совместимости): settings.POSTGRES_USER и др.
    """

    # --- PostgreSQL ---
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int = 5432

    # --- Безопасность и JWT ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENABLE_DOCS: bool = False
    SQL_ECHO: bool = False

    # --- Сетевые настройки и CORS ---
    ALLOWED_ORIGINS: str
    FRONTEND_BASE_URL: str = "http://localhost:8090"
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "strict"
    DEFAULT_TIMEZONE: str = "Asia/Almaty"
    MAX_OVERTIME_HOURS: int = 24

    # --- Telegram интеграция ---
    TELEGRAM_BOT_TOKEN: str | None = None

    # --- MS Graph Settings ---
    MS_CLIENT_ID: str | None = None
    MS_CLIENT_SECRET: str | None = None
    MS_TENANT_ID: str | None = None
    MS_SENDER_EMAIL: str | None = None

    # --- Odoo CRM Settings ---
    ODOO_URL: str | None = None
    ODOO_DB: str | None = None
    ODOO_USER: str | None = None
    ODOO_PASSWORD: str | None = None
    ODOO_INTEGRATION_URL: str | None = None
    ODOO_INTEGRATION_KEY: str | None = None

    # --- Authentik OIDC Settings ---
    AUTHENTIK_BASE_URL: str | None = None
    AUTHENTIK_CLIENT_ID: str | None = None
    AUTHENTIK_CLIENT_SECRET: str | None = None
    AUTHENTIK_REDIRECT_URI: str | None = None
    AUTHENTIK_APPLICATION_SLUG: str = "overtime"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # ── Доступ к сгруппированным настройкам подсистем ──

    @property
    def db(self) -> DatabaseSettings:
        """Сгруппированные параметры подключения к PostgreSQL."""
        return DatabaseSettings(
            user=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            db=self.POSTGRES_DB,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
        )

    @property
    def ms_graph(self) -> MSGraphSettings:
        """Сгруппированные параметры Microsoft Graph API."""
        return MSGraphSettings(
            client_id=self.MS_CLIENT_ID,
            client_secret=self.MS_CLIENT_SECRET,
            tenant_id=self.MS_TENANT_ID,
            sender_email=self.MS_SENDER_EMAIL,
        )

    @property
    def odoo(self) -> OdooSettings:
        """Сгруппированные параметры интеграции с Odoo CRM."""
        return OdooSettings(
            url=self.ODOO_URL,
            db=self.ODOO_DB,
            user=self.ODOO_USER,
            password=self.ODOO_PASSWORD,
            integration_url=self.ODOO_INTEGRATION_URL,
            integration_key=self.ODOO_INTEGRATION_KEY,
        )

    @property
    def authentik(self) -> AuthentikSettings:
        """Сгруппированные параметры OIDC/SSO провайдера Authentik."""
        return AuthentikSettings(
            base_url=self.AUTHENTIK_BASE_URL,
            client_id=self.AUTHENTIK_CLIENT_ID,
            client_secret=self.AUTHENTIK_CLIENT_SECRET,
            redirect_uri=self.AUTHENTIK_REDIRECT_URI,
            application_slug=self.AUTHENTIK_APPLICATION_SLUG,
        )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Возвращает список CORS-origins из строки с разделителем ','."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def tz_info(self) -> ZoneInfo:
        """Возвращает объект временной зоны на основе DEFAULT_TIMEZONE."""
        return ZoneInfo(self.DEFAULT_TIMEZONE)


settings = Settings()
