from pydantic import BaseModel, ConfigDict
from app.models.organization import ProjectStatus
from typing import List, Optional
from datetime import datetime
from app.schemas.user import UserResponse, PermissionResponse
from app.schemas.crm import CRMStageResponse, TaskResponse
from app.schemas.overtime import OvertimeResponse


# --- Departments ---

class DepartmentBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    extra_data: Optional[dict] = {}

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    extra_data: Optional[dict] = None

class DepartmentResponse(DepartmentBase):
    id: int
    manager: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class DepartmentTreeResponse(DepartmentResponse):
    sub_departments: List["DepartmentTreeResponse"] = []

    model_config = ConfigDict(from_attributes=True)


# --- Job Positions (Штатное расписание) ---

class JobPositionBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    department_id: Optional[int] = None

class JobPositionCreate(JobPositionBase):
    pass

class JobPositionUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    department_id: Optional[int] = None

class JobPositionResponse(JobPositionBase):
    id: int
    department: Optional[DepartmentResponse] = None
    permissions: List[PermissionResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class PositionPermissionsSync(BaseModel):
    """Схема для синхронизации прав должности."""
    permission_ids: List[int]

class HierarchyNodeResponse(JobPositionResponse):
    sub_positions: List["HierarchyNodeResponse"] = []
    users: List[UserResponse] = []
    model_config = ConfigDict(from_attributes=True)


# --- Projects ---

class ProjectBase(BaseModel):
    name: str
    manager_id: Optional[int] = None
    weekly_limit: int = 50
    deal_id: Optional[int] = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    gip_id: Optional[int] = None
    lead_engineer_id: Optional[int] = None
    lead_programmer_id: Optional[int] = None
    extra_data: Optional[dict] = {}
    stage_id: Optional[int] = None
    
    # Финансы
    budget: Optional[float] = 0.0
    gross_profit: Optional[float] = 0.0
    net_profit: Optional[float] = 0.0
    turnover: Optional[float] = 0.0
    labor_cost: Optional[float] = 0.0
    ntk: Optional[float] = 0.0
    aup: Optional[float] = 0.0
    
    # Документы
    doc_spec_url: Optional[str] = None
    doc_tech_spec_url: Optional[str] = None
    doc_schemes_url: Optional[str] = None
    doc_client_export_url: Optional[str] = None

class ProjectAttachmentResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    file_path: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    manager_id: Optional[int] = None
    weekly_limit: Optional[int] = None
    deal_id: Optional[int] = None
    status: Optional[ProjectStatus] = None
    gip_id: Optional[int] = None
    lead_engineer_id: Optional[int] = None
    lead_programmer_id: Optional[int] = None
    extra_data: Optional[dict] = None
    stage_id: Optional[int] = None
    budget: Optional[float] = None
    gross_profit: Optional[float] = None
    net_profit: Optional[float] = None
    turnover: Optional[float] = None
    labor_cost: Optional[float] = None
    ntk: Optional[float] = None
    aup: Optional[float] = None
    doc_spec_url: Optional[str] = None
    doc_tech_spec_url: Optional[str] = None
    doc_schemes_url: Optional[str] = None
    doc_client_export_url: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    manager: Optional[UserResponse] = None
    gip: Optional[UserResponse] = None
    stage: Optional[CRMStageResponse] = None
    
    # Списки связанных данных
    tasks: List[TaskResponse] = []
    overtimes: List[OvertimeResponse] = []
    attachments: List[ProjectAttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
