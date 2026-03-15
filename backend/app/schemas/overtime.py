from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.overtime import OvertimeStatus
from app.models.user import UserRole


class OvertimeBase(BaseModel):
    project_id: int
    start_time: datetime
    end_time: datetime
    description: str
    start_lat: float | None = None
    start_lng: float | None = None
    end_lat: float | None = None
    end_lng: float | None = None


class OvertimeCreate(OvertimeBase):
    pass


class OvertimeUpdate(BaseModel):
    project_id: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    description: str | None = None


class ProjectMini(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class UserMini(BaseModel):
    id: int
    full_name: str | None = None
    email: str
    model_config = ConfigDict(from_attributes=True)


class OvertimeResponse(OvertimeBase):
    id: int
    user_id: int
    status: OvertimeStatus

    # Поля согласования
    manager_approved: bool | None
    head_approved: bool | None
    manager_comment: str | None
    head_comment: str | None

    created_at: datetime

    project: ProjectMini | None = None
    user: UserMini | None = None
    hours: float

    model_config = ConfigDict(from_attributes=True)


class OvertimeReview(BaseModel):
    approved: bool
    comment: str | None = None
    as_role: UserRole | None = None


class ProjectHours(BaseModel):
    project_name: str
    hours: float


class PersonalStats(BaseModel):
    current_month_hours: float
    last_month_hours: float
    total_hours: float
    by_project: list[ProjectHours]
