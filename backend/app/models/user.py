import enum
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.organization import JobPosition

from sqlalchemy import String, Boolean, Enum, Integer, DateTime, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Таблица связи Ролей и Прав
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

# Таблица связи Должностей и Прав
position_permissions = Table(
    "position_permissions",
    Base.metadata,
    Column("position_id", Integer, ForeignKey("job_positions.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Permission(Base):
    """Права доступа (например: 'create_lead', 'view_all_tasks')."""
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))


class Role(Base):
    """Роли пользователей (например: 'Администратор', 'ГИП', 'Инженер')."""
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    
    users: Mapped[List["User"]] = relationship("User", back_populates="role_obj")
    # Права роли всегда подгружаются для проверки доступа
    permissions: Mapped[List[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )


class UserCompany(str, enum.Enum):
    Polymedia = "Polymedia"
    AJ_techCom = "AJ-techCom"



class TwoFAMethod(str, enum.Enum):
    email = "email"
    totp = "totp"


class User(Base):
    """
    SQLAlchemy модель пользователя с динамическими ролями.
    """
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    
    # Отношения (будут определены ниже после полей FK)
    
    # Отношения
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    overtimes = relationship("Overtime", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    
    # Для обратной совместимости во время миграции оставим старое поле (потом удалим)
    role: Mapped[str] = mapped_column(String, default="employee")
    
    # Связь с ролью
    role_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("roles.id"))
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    position_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("job_positions.id", ondelete="SET NULL"))
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Отношения (определены здесь, чтобы видеть поля ID выше)
    role_obj: Mapped[Role | None] = relationship("Role", back_populates="users", lazy="selectin")
    job_position: Mapped["JobPosition | None"] = relationship("JobPosition", back_populates="users", lazy="selectin")
    department: Mapped["Department | None"] = relationship("Department", back_populates="users", foreign_keys=[department_id])
    
    company: Mapped[UserCompany] = mapped_column(
        Enum(UserCompany, name='usercompany', native_enum=False),
        default=UserCompany.Polymedia
    )
    
    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notification_level: Mapped[int] = mapped_column(Integer, default=2)
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_fa_method: Mapped[TwoFAMethod] = mapped_column(
        Enum(TwoFAMethod, name='twofamethod', native_enum=False),
        default=TwoFAMethod.email
    )
    totp_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    @property
    def role_name(self) -> str:
        if self.role_obj:
            return self.role_obj.name
        return self.role # fallback to old column

    @property
    def department_name(self) -> str | None:
        return self.department.name if self.department else None

    @property
    def position_name(self) -> str | None:
        return self.job_position.name if self.job_position else None

    @property
    def permissions(self) -> list[str]:
        """
        Собирает все уникальные права пользователя из его роли и должности.
        """
        perms = set()
        if self.role_obj and self.role_obj.permissions:
            for p in self.role_obj.permissions:
                perms.add(p.name)
        if self.job_position and self.job_position.permissions:
            for p in self.job_position.permissions:
                perms.add(p.name)
        return list(perms)


class OTPType(str, enum.Enum):
    login = "login"
    password_reset = "password_reset"


class UserOTP(Base):
    __tablename__ = "user_otps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    type: Mapped[OTPType] = mapped_column(Enum(OTPType, native_enum=False), default=OTPType.login)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
