from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_full_name: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}
