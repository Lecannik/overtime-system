import enum
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Integer, ForeignKey, JSON, Boolean, Enum, DateTime, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class TriggerType(str, enum.Enum):
    STAGE_CHANGED = "stage_changed"  # Смена стадии (Лид/Сделка/Проект)
    ENTITY_CREATED = "entity_created"  # Создание новой записи
    FIELD_CHANGED = "field_changed"  # Изменение конкретного поля
    DEADLINE_接近 = "deadline_approaching"  # Приближение дедлайна
    TIME_DELAY = "time_delay"  # Прошло X времени с момента создания/изменения

class ActionType(str, enum.Enum):
    CREATE_TASK = "create_task"  # Авто-создание задачи
    SEND_NOTIFICATION = "send_notification"  # Отправка в Telegram/Email
    SET_FIELD = "set_field"  # Изменение поля (например, статус)
    SET_RESPONSIBLE = "set_responsible"  # Смена ответственного
    CALL_WEBHOOK = "call_webhook"  # Внешний запрос

class BPMWorkflow(Base):
    """
    Основная модель бизнес-процесса.
    Определяет 'набор правил' для автоматизации.
    """
    __tablename__ = "bpm_workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # К какой сущности относится (lead, deal, project, task)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Связи
    triggers: Mapped[List["BPMTrigger"]] = relationship("BPMTrigger", back_populates="workflow", cascade="all, delete-orphan")
    actions: Mapped[List["BPMAction"]] = relationship("BPMAction", back_populates="workflow", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

class BPMTrigger(Base):
    """
    Условие запуска процесса.
    """
    __tablename__ = "bpm_triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("bpm_workflows.id", ondelete="CASCADE"))
    
    type: Mapped[TriggerType] = mapped_column(Enum(TriggerType, native_enum=False), nullable=False)
    
    # Параметры триггера в JSON (например: target_stage_id: 5)
    params: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Дополнительные фильтры (например: if budget > 1000)
    conditions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    workflow: Mapped["BPMWorkflow"] = relationship("BPMWorkflow", back_populates="triggers")

class BPMAction(Base):
    """
    Действие, которое выполняется при срабатыванию триггера.
    """
    __tablename__ = "bpm_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("bpm_workflows.id", ondelete="CASCADE"))
    
    type: Mapped[ActionType] = mapped_column(Enum(ActionType, native_enum=False), nullable=False)
    
    # Параметры действия (например: task_template_id, recipient_id, field_name)
    params: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Порядковый номер выполнения
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    workflow: Mapped["BPMWorkflow"] = relationship("BPMWorkflow", back_populates="actions")

class BPMLog(Base):
    """
    История выполнения процессов для отладки.
    """
    __tablename__ = "bpm_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("bpm_workflows.id", ondelete="SET NULL"), nullable=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)  # ID Лида/Сделки и т.д.
    
    status: Mapped[str] = mapped_column(String(50))  # success, error
    message: Mapped[Optional[str]] = mapped_column(String(1000))
    execution_time: Mapped[float] = mapped_column(Integer)  # ms
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
