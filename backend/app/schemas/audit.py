from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class AuditLogUserSummary(BaseModel):
    full_name: str

class AuditLogEntry(BaseModel):
    id: int
    user_id: int
    user: AuditLogUserSummary
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = {"from_attributes": True}

class PaginatedAuditResponse(BaseModel):
    items: List[AuditLogEntry]
    total: int
