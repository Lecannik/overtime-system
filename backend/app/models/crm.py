import enum
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, DateTime, Float, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.organization import Project


class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    LOST = "LOST"
    CONVERTED = "CONVERTED"


class DealStatus(str, enum.Enum):
    DISCOVERY = "DISCOVERY"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    WON = "WON"
    LOST = "LOST"


class CRMStage(Base):
    """
    Динамические стадии для Лидов и Сделок.
    """
    __tablename__ = "crm_stages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    module: Mapped[str] = mapped_column(String(20), nullable=False) # 'LEAD', 'DEAL' or 'PROJECT'
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Counterparty(Base):
    """
    Контрагенты (Клиенты / Партнеры).
    """
    __tablename__ = "counterparties"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kpp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ogrn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    legal_address: Mapped[str | None] = mapped_column(String, nullable=True)
    postal_address: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Отношения
    manager: Mapped[Optional["User"]] = relationship(foreign_keys=[manager_id])
    leads: Mapped[List["Lead"]] = relationship(back_populates="counterparty")
    deals: Mapped[List["Deal"]] = relationship(back_populates="counterparty")


class Lead(Base):
    """
    Модель Лида.
    """
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Связь с контрагентом
    counterparty_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("counterparties.id"))
    counterparty: Mapped[Counterparty | None] = relationship(back_populates="leads")
    
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    
    stage_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("crm_stages.id"))
    stage: Mapped[CRMStage | None] = relationship("CRMStage")
    
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus, native_enum=False), default=LeadStatus.NEW)
    
    assigned_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    assigned: Mapped["User"] = relationship(foreign_keys=[assigned_id])
    
    deals: Mapped[List["Deal"]] = relationship(back_populates="lead")
    tasks: Mapped[List["Task"]] = relationship(back_populates="lead")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Deal(Base):
    """
    Модель Сделки.
    """
    __tablename__ = "deals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leads.id"))
    counterparty_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("counterparties.id"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Финансы сделки
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String, default="RUB")
    
    # Ссылки на документы
    contract_url: Mapped[str | None] = mapped_column(String, nullable=True)
    client_export_url: Mapped[str | None] = mapped_column(String, nullable=True)
    
    stage_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("crm_stages.id"))
    stage: Mapped[CRMStage | None] = relationship("CRMStage")
    
    status: Mapped[DealStatus] = mapped_column(Enum(DealStatus, native_enum=False), default=DealStatus.DISCOVERY)
    
    assigned_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"))
    
    lead: Mapped["Lead"] = relationship(back_populates="deals")
    counterparty: Mapped[Counterparty | None] = relationship(back_populates="deals")
    assigned: Mapped["User"] = relationship(foreign_keys=[assigned_id])
    project: Mapped["Project"] = relationship(foreign_keys=[project_id])
    
    tasks: Mapped[List["Task"]] = relationship(back_populates="deal")
    attachments: Mapped[List["DealAttachment"]] = relationship(back_populates="deal", cascade="all, delete-orphan")

    # Расширенные финансовые поля (для выгрузки из Excel)
    gross_profit: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    net_profit: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    turnover: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    labor_cost: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DealAttachment(Base):
    """
    Модель вложения (файла) к сделке.
    """
    __tablename__ = "deal_attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[int | None] = mapped_column(Integer)
    
    deal: Mapped["Deal"] = relationship(back_populates="attachments")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )



