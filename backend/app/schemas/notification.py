from datetime import datetime
from pydantic import BaseModel, ConfigDict

class NotificationBase(BaseModel):
    title: str
    message: str

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
