import enum
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Enum, Integer, DateTime, ForeignKey, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    """
    Перечисление ролей пользователей в системе.
    Определяет права доступа к функционалу согласования и администрирования.
    """
    employee = "employee"
    manager = "manager"
    head = "head"
    admin = "admin"


class UserCompany(str, enum.Enum):
    """
    Перечисление компаний, в которых могут работать пользователи.
    """
    Polymedia = "Polymedia"
    AJ_techCom = "AJ-techCom"


class UserCompanyType(TypeDecorator):
    """
    Пользовательский тип SQLAlchemy для работы с перечислением UserCompany.
    
    Обеспечивает корректное преобразование членов перечисления в их
    строковые значения (value) при записи в базу данных и обратно при чтении.
    Это необходимо для корректной работы с типом ENUM в PostgreSQL,
    где значение сохраняется как 'AJ-techCom' (с дефисом), в то время как
    в Python имя члена перечисления записано как AJ_techCom (с подчеркиванием).
    """
    impl = Enum(UserCompany, name='usercompany', values_callable=lambda enum: [e.value for e in enum])
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """
        Преобразует Python-значение перед отправкой в базу данных.
        """
        if value is None:
            return None
        if hasattr(value, 'value'):
            return value.value
        return str(value)

    def process_result_value(self, value, dialect):
        """
        Преобразует значение из базы данных в Python-объект.
        """
        if value is None:
            return None
        try:
            return UserCompany(value)
        except ValueError:
            return value


class NotificationLevel(enum.IntEnum):
    """
    Уровни уведомлений пользователя:
    0: OFF — Уведомления отключены
    1: EMAIL_ONLY — Только Email уведомления (финальные решения)
    2: ALL — Email и Telegram уведомления
    3: TELEGRAM_ONLY — Только Telegram уведомления
    """
    OFF = 0
    EMAIL_ONLY = 1
    ALL = 2
    TELEGRAM_ONLY = 3


class User(Base):
    """
    SQLAlchemy модель пользователя.
    Хранит основную информацию о сотруднике, его роли, отделе и настройках безопасности.
    
    Attributes:
        full_name: ФИО сотрудника.
        email: Уникальный адрес почты (используется для входа).
        hashed_password: Захешированный пароль.
        role: Роль в системе (UserRole).
        must_change_password: Флаг принудительной смены пароля (например, после сброса админом).
    """
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.employee)
    company: Mapped[UserCompany] = mapped_column(
        UserCompanyType,
        default=UserCompany.Polymedia
    )
    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notification_level: Mapped[NotificationLevel] = mapped_column(Integer, default=NotificationLevel.ALL)
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )


class OTPType(str, enum.Enum):
    """Типы одноразовых кодов подтверждения."""
    login = "login"
    password_reset = "password_reset"


class UserOTP(Base):
    """
    Модель для хранения временных кодов 2FA и восстановления пароля.
    """
    __tablename__ = "user_otps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    type: Mapped[OTPType] = mapped_column(Enum(OTPType), default=OTPType.login)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class RefreshToken(Base):
    """
    Модель для хранения refresh-токенов пользователей.
    Используется для ротации и поддержания безопасных сессий.
    """
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
