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
    """
    Статусы жизненного цикла заявки на переработку.
    Используются для управления процессом согласования (Workflow).
    """
    PENDING = "PENDING"                    # Ожидает действий руководителей
    MANAGER_APPROVED = "MANAGER_APPROVED"  # Одобрено менеджером проекта
    HEAD_APPROVED = "HEAD_APPROVED"        # Одобрено начальником отдела
    APPROVED = "APPROVED"                  # Финальное одобрение (оба подтвердили)
    REJECTED = "REJECTED"                  # Отклонено (хотя бы одним руководителем)
    CANCELLED = "CANCELLED"                # Отменено самим сотрудником или админом

    @property
    def russian_label(self) -> str:
        """Возвращает человекочитаемое название статуса на русском."""
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
    """
    SQLAlchemy модель записи о переработке.
    Это "Склад" данных — то, как они физически лежат в таблице `overtimes`.
    
    Attributes:
        user_id: ID сотрудника, создавшего заявку.
        project_id: ID проекта, по которому выполнялась работа.
        start_time / end_time: Временной интервал переработки.
        description: Описание того, что именно делал сотрудник.
        location_name: Название объекта или адрес выполнения работ.
        manager_approved / head_approved: Флаги решений руководителей.
        approved_hours: Итоговое количество часов, которое будет оплачено/учтено.
    """
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
    location_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Поля согласования
    manager_approved: Mapped[bool | None] = mapped_column(Boolean, default=None)
    head_approved: Mapped[bool | None] = mapped_column(Boolean, default=None)

    # Комментарии (почему одобрил или отклонил)
    manager_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    head_comment: Mapped[str | None] = mapped_column(String, nullable=True)

    approved_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[OvertimeStatus] = mapped_column(
        Enum(OvertimeStatus),
        default=OvertimeStatus.PENDING,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Связи (Relationships) для удобного доступа к связанным данным
    project: Mapped["Project"] = relationship("Project")
    user: Mapped["User"] = relationship("User")

    @property
    def hours(self) -> float:
        """
        Метод-свойство. Рассчитывает длительность в часах 
        с применением бизнес-логики (например, округление).
        """
        return calculate_overtime_hours(self.start_time, self.end_time)

    @property
    def raw_hours(self) -> float:
        """
        Возвращает чистую разницу во времени без учета 
        бизнес-правил округления.
        """
        delta = self.end_time - self.start_time
        return delta.total_seconds() / 3600.0
