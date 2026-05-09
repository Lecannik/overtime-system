from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


# --- CRM Stages ---

class CRMStageBase(BaseModel):
    name: str
    module: str # 'LEAD', 'DEAL' or 'PROJECT'
    color: str = "#3b82f6"
    sort_order: int = 0

class CRMStageCreate(CRMStageBase):
    pass

class CRMStageUpdate(BaseModel):
    name: Optional[str] = None
    module: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class CRMStageResponse(CRMStageBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Counterparties (Контрагенты) ---

class CounterpartyBase(BaseModel):
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None
    legal_address: Optional[str] = None
    postal_address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    manager_id: Optional[int] = None

class CounterpartyCreate(CounterpartyBase):
    pass

class CounterpartyUpdate(BaseModel):
    name: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None
    legal_address: Optional[str] = None
    postal_address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    manager_id: Optional[int] = None

class CounterpartyResponse(CounterpartyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# Импортируем Task schemas из модуля задач, чтобы избежать дублирования
from app.schemas.task import TaskResponse, TaskCreate, TaskUpdate, TaskStatusResponse, TaskTypeResponse


# --- Leads ---

class LeadBase(BaseModel):
    title: str
    description: Optional[str] = None
    counterparty_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    source: Optional[str] = None
    stage_id: Optional[int] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    counterparty_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    source: Optional[str] = None
    stage_id: Optional[int] = None

class LeadResponse(LeadBase):
    id: int
    created_at: datetime
    updated_at: datetime
    stage: Optional[CRMStageResponse] = None
    counterparty: Optional[CounterpartyResponse] = None
    tasks: List[TaskResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- Deals ---

class DealBase(BaseModel):
    title: str
    description: Optional[str] = None
    budget: float = 0.0
    currency: str = "RUB"
    counterparty_id: Optional[int] = None
    contract_url: Optional[str] = None
    client_export_url: Optional[str] = None
    stage_id: Optional[int] = None
    lead_id: Optional[int] = None
    assigned_id: Optional[int] = None
    project_id: Optional[int] = None
    
    # Finances
    gross_profit: Optional[float] = 0.0
    net_profit: Optional[float] = 0.0
    turnover: Optional[float] = 0.0
    labor_cost: Optional[float] = 0.0

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    currency: Optional[str] = None
    counterparty_id: Optional[int] = None
    contract_url: Optional[str] = None
    client_export_url: Optional[str] = None
    stage_id: Optional[int] = None
    lead_id: Optional[int] = None
    assigned_id: Optional[int] = None
    project_id: Optional[int] = None

class DealAttachmentResponse(BaseModel):
    id: int
    deal_id: int
    filename: str
    file_path: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime
    stage: Optional[CRMStageResponse] = None
    counterparty: Optional[CounterpartyResponse] = None
    tasks: List[TaskResponse] = []
    attachments: List[DealAttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
