from enum import Enum as PyEnum
from datetime import datetime, timezone
import math
from sqlalchemy import (
    Boolean,
    Integer,
    String,
    Enum,
    ForeignKey,
    DateTime,
    Float,
    Date
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import User
from app.models.organization import Project
from app.core.utils import calculate_overtime_hours


class OvertimeStatus(str, PyEnum):
    PENDING = "PENDING"                    # Ожидает
    MANAGER_APPROVED = "MANAGER_APPROVED"  # Согласовано менеджером
    HEAD_APPROVED = "HEAD_APPROVED"        # Согласовано нач. отдела
    APPROVED = "APPROVED"                  # Полностью одобрено (оба Ок)
    REJECTED = "REJECTED"                  # Отклонено
    CANCELLED = "CANCELLED"                # Отменено пользователем или админом

    @property
    def russian_label(self) -> str:
        """Возвращает название статуса на русском языке."""
        labels = {
            OvertimeStatus.PENDING: "Ожидает",
            OvertimeStatus.MANAGER_APPROVED: "Одобрено менеджером",
            OvertimeStatus.HEAD_APPROVED: "Одобрено нач. отдела",
            OvertimeStatus.APPROVED: "Подтверждено",
            OvertimeStatus.REJECTED: "Отклонено",
            OvertimeStatus.CANCELLED: "Отменено"
        }
        return labels.get(self, str(self.value))


class Overtime(Base):
    __tablename__ = "overtimes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)

    start_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    end_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    description: Mapped[str] = mapped_column(String, nullable=False)

    # Поля согласования
    manager_approved: Mapped[bool | None] = mapped_column(Boolean, default=None)
    head_approved: Mapped[bool | None] = mapped_column(Boolean, default=None)

    # Комментарии (почему одобрил или отклонил)
    manager_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    head_comment: Mapped[str | None] = mapped_column(String, nullable=True)

    status: Mapped[OvertimeStatus] = mapped_column(
        Enum(OvertimeStatus),
        default=OvertimeStatus.PENDING,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project")
    user: Mapped["User"] = relationship("User")

    @property
    def hours(self) -> float:
        """Рассчитывает длительность переработки в часах (округляя в большую сторону до целого)."""
        return calculate_overtime_hours(self.start_time, self.end_time)
