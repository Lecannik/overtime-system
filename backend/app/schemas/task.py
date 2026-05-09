from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.task import TaskPriority


class TaskTypeBase(BaseModel):
    name: str
    color: str = "#3b82f6"
    icon: Optional[str] = None
    is_active: bool = True

class TaskTypeCreate(TaskTypeBase):
    pass

class TaskTypeUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None

class TaskTypeResponse(TaskTypeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class TaskStatusBase(BaseModel):
    name: str
    color: str = "#94a3b8"
    sort_order: int = 0
    is_active: bool = True

class TaskStatusCreate(TaskStatusBase):
    pass

class TaskStatusUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class TaskStatusResponse(TaskStatusBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    project_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status_id: Optional[int] = None
    status: Optional[str] = None # Legacy/Fallback
    priority: TaskPriority = TaskPriority.MEDIUM
    type_id: Optional[int] = None
    type: Optional[str] = None # Fallback/Legacy
    assigned_id: int | None = None
    department_id: Optional[int] = None
    deadline: datetime | None = None
    start_date: Optional[datetime] = None
    parent_id: int | None = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None

class TaskCreate(TaskBase):
    creator_id: int

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status_id: int | None = None
    status: str | None = None
    priority: TaskPriority | None = None
    type_id: int | None = None
    type: str | None = None
    assigned_id: int | None = None
    department_id: int | None = None
    deadline: datetime | None = None
    start_date: Optional[datetime] = None
    parent_id: int | None = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None

class UserShort(BaseModel):
    id: int
    full_name: str
    model_config = ConfigDict(from_attributes=True)

class DepartmentShort(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class LeadShort(BaseModel):
    id: int
    title: str
    model_config = ConfigDict(from_attributes=True)

class DealShort(BaseModel):
    id: int
    title: str
    model_config = ConfigDict(from_attributes=True)

class ProjectShort(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class TaskAttachmentResponse(BaseModel):
    id: int
    filename: str
    size: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskCommentResponse(BaseModel):
    id: int
    content: str
    author_id: int
    author: Optional[UserShort] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskCommentCreate(BaseModel):
    content: str

class TaskResponse(TaskBase):
    id: int
    creator_id: int
    creator: Optional[UserShort] = None
    assigned: Optional[UserShort] = None
    task_status: Optional[TaskStatusResponse] = None
    task_type: Optional[TaskTypeResponse] = None
    department: Optional[DepartmentShort] = None
    project: Optional[ProjectShort] = None
    lead: Optional[LeadShort] = None
    deal: Optional[DealShort] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[TaskAttachmentResponse] = []
    comments: List[TaskCommentResponse] = []

    model_config = ConfigDict(from_attributes=True)
