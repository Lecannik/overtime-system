import enum
from sqlalchemy import Integer, String, ForeignKey, Enum, JSON, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from typing import List, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.crm import Deal, CRMStage
    from app.models.task import Task
    from app.models.overtime import Overtime
    from app.models.user import Permission


class ProjectStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Department(Base):
    """
    Модель отдела организации с поддержкой иерархии.
    """
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    
    # Иерархия отделов
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="CASCADE"))
    sub_departments: Mapped[List["Department"]] = relationship("Department", back_populates="parent")
    parent: Mapped["Department | None"] = relationship("Department", back_populates="sub_departments", remote_side=[id])
    
    # Руководитель отдела
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    manager: Mapped["User | None"] = relationship("User", foreign_keys=[manager_id])
    
    # Дополнительные настройки отдела (например, лимиты по умолчанию)
    extra_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    
    # Список сотрудников отдела
    users: Mapped[List["User"]] = relationship("User", back_populates="department", foreign_keys="User.department_id")


class JobPosition(Base):
    """
    Модель должности (Штатное расписание).
    Позволяет создавать иерархию управления: Гендиректор -> Директор -> Менеджер.
    """
    __tablename__ = "job_positions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    
    # Иерархия должностей
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("job_positions.id", ondelete="CASCADE"))
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    
    # Отношения
    department: Mapped["Department | None"] = relationship()
    sub_positions: Mapped[List["JobPosition"]] = relationship("JobPosition", back_populates="parent")
    parent: Mapped["JobPosition | None"] = relationship("JobPosition", back_populates="sub_positions", remote_side=[id])
    
    # Пользователи на этой должности
    users: Mapped[List["User"]] = relationship("User", back_populates="job_position")
    
    # Права доступа, специфичные для этой должности
    permissions: Mapped[List["Permission"]] = relationship(
        secondary="position_permissions", lazy="selectin"
    )


class Project(Base):
    """
    Модель рабочего проекта.
    """
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    
    # Менеджер проекта (первый уровень согласования)
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    manager: Mapped["User | None"] = relationship("User", foreign_keys=[manager_id])
    
    # Лимит переработок в часах на неделю
    weekly_limit: Mapped[int] = mapped_column(Integer, default=50)
    
    # --- CRM/ERP ---
    deal_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("deals.id"))
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus, native_enum=False), default=ProjectStatus.ACTIVE)
    
    # Роли в проекте
    gip_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    lead_engineer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    lead_programmer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    # Динамическая стадия (BPMN)
    stage_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("crm_stages.id"))
    stage: Mapped["CRMStage | None"] = relationship("CRMStage")
    
    gip: Mapped["User | None"] = relationship("User", foreign_keys=[gip_id])

    # Финансовые показатели (подтягиваются из спецификаций)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    gross_profit: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    net_profit: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    turnover: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    labor_cost: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    ntk: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    aup: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    
    # Ссылки на документы проекта
    doc_spec_url: Mapped[str | None] = mapped_column(String, nullable=True)     # Спецификация
    doc_tech_spec_url: Mapped[str | None] = mapped_column(String, nullable=True)# Техзадание (ТЗ)
    doc_schemes_url: Mapped[str | None] = mapped_column(String, nullable=True)  # Схемы подключения
    doc_client_export_url: Mapped[str | None] = mapped_column(String, nullable=True) # Выгрузка клиенту
    
    # Динамические поля
    extra_data: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # Отношения к задачам и переработкам
    tasks: Mapped[List["Task"]] = relationship(back_populates="project")
    overtimes: Mapped[List["Overtime"]] = relationship(back_populates="project")
    attachments: Mapped[List["ProjectAttachment"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectAttachment(Base):
    """
    Модель вложения (файла) к проекту.
    """
    __tablename__ = "project_attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[int | None] = mapped_column(Integer)
    
    project: Mapped["Project"] = relationship(back_populates="attachments")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
