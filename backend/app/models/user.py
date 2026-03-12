import enum
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Enum, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    employee = "employee"
    manager = "manager"
    head = "head"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.employee)
    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notification_level: Mapped[int] = mapped_column(Integer, default=2)  # 0: Off, 1: Major, 2: All
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
