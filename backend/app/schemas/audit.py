from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List


class AuditLogUserSummary(BaseModel):
    """Краткая информация о пользователе, совершившем действие."""
    full_name: str
    email: Optional[str] = None


class AuditLogEntry(BaseModel):
    """Схема записи журнала аудита для ответа API."""
    id: int
    user_id: Optional[int] = None
    user: Optional[AuditLogUserSummary] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class PaginatedAuditResponse(BaseModel):
    """Схема пагинированного ответа списка логов аудита."""
    items: List[AuditLogEntry]
    total: int

