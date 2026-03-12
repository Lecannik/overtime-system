from pydantic import BaseModel
from typing import List, Optional

class AnalyticsSummary(BaseModel):
    total_hours: float
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int

class ProjectAnalytics(BaseModel):
    project_id: int
    project_name: str
    total_hours: float
    request_count: int

class DepartmentAnalytics(BaseModel):
    department_id: int
    department_name: str
    total_hours: float
    request_count: int

class UserAnalytics(BaseModel):
    user_id: int
    full_name: str
    total_hours: float
    request_count: int
