from pydantic import BaseModel
from typing import List, Optional

class AnalyticsSummary(BaseModel):
    total_hours: float
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int

class ProjectAnalytics(BaseModel):
    """Аналитика по количеству часов переработок в проекте."""
    project_id: int
    project_name: str
    total_hours: float
    request_count: int
    turnover: float = 0.0
    net_profit: float = 0.0

class ProjectFinanceResponse(BaseModel):
    """Финальная сводка по финансам компании."""
    total_turnover: float
    total_profit: float
    active_projects_count: int
    total_overtime_hours: float

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
    project_name: Optional[str] = None

class ReviewAnalytics(BaseModel):
    total_requested_hours: float
    total_approved_hours: float
    more_than_requested_count: int    # Кол-во заявок, где дали больше
    less_than_requested_count: int    # Кол-во заявок, где дали меньше (частичное одобрение)
    exact_match_count: int            # Кол-во заявок, где согласовали точно как просили
    total_reviewed_requests: int      # Общее кол-во рассмотренных заявок (approved/rejected)
