import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.organization import Project
    from app.models.crm import Lead, Deal


class TaskStatus(Base):
    """
    Кастомные статусы задач (например: 'В очереди', 'На согласовании', 'Готово').
    """
    __tablename__ = "task_statuses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#94a3b8")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tasks: Mapped[list["Task"]] = relationship(back_populates="task_status")


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskType(Base):
    """
    Динамические типы задач (например: 'Звонок', 'ТЗ', 'Расчет').
    """
    __tablename__ = "task_types"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")
    icon: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tasks: Mapped[list["Task"]] = relationship(back_populates="task_type")


class Task(Base):
    """
    Модель задачи. Может быть привязана к Проекту, Лиду или Сделке.
    """
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"), nullable=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    deal_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=True)
    
    # Отдел, к которому относится задача (для управления руководителем)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Новый кастомный статус
    status_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("task_statuses.id"), nullable=True)
    # Старый статус для совместимости
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority, native_enum=False), default=TaskPriority.MEDIUM)
    
    # Ссылка на динамический тип задачи
    type_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("task_types.id"), nullable=True)
    # Поле type оставляем для обратной совместимости во время миграции или простых случаев
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id"))
    
    extra_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    
    # Отношения
    task_status: Mapped[TaskStatus | None] = relationship(back_populates="tasks")
    task_type: Mapped[TaskType | None] = relationship(back_populates="tasks")
    project: Mapped["Project"] = relationship(back_populates="tasks", foreign_keys=[project_id])
    lead: Mapped["Lead"] = relationship(back_populates="tasks", foreign_keys=[lead_id])
    deal: Mapped["Deal"] = relationship(back_populates="tasks", foreign_keys=[deal_id])
    department: Mapped["Department | None"] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[creator_id])
    assigned: Mapped["User"] = relationship(foreign_keys=[assigned_id])
    attachments: Mapped[list["TaskAttachment"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    comments: Mapped[list["TaskComment"]] = relationship(back_populates="task", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )


class TaskComment(Base):
    __tablename__ = "task_comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    
    task: Mapped["Task"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship()
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )


class TaskAttachment(Base):
    __tablename__ = "task_attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[int | None] = mapped_column(Integer)
    
    task: Mapped["Task"] = relationship(back_populates="attachments")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
