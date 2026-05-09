from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class StagePermissionBase(BaseModel):
    position_id: Optional[int] = None
    user_id: Optional[int] = None
    stage_id: int
    can_view: bool = True
    can_edit: bool = False

class StagePermissionCreate(StagePermissionBase):
    pass

class StagePermissionResponse(StagePermissionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class SyncStagePermissions(BaseModel):
    """Схема для массового обновления прав (матрица)."""
    position_id: Optional[int] = None
    user_id: Optional[int] = None
    allowed_stage_ids: List[int]
