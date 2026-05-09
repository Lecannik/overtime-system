from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.bpm import TriggerType, ActionType

class BPMTriggerBase(BaseModel):
    type: TriggerType
    params: Dict[str, Any] = {}
    conditions: Optional[Dict[str, Any]] = None

class BPMTriggerResponse(BPMTriggerBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BPMActionBase(BaseModel):
    type: ActionType
    params: Dict[str, Any] = {}
    sort_order: int = 0

class BPMActionResponse(BPMActionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BPMWorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    entity_type: str  # lead, deal, project, task

class BPMWorkflowCreate(BPMWorkflowBase):
    triggers: List[BPMTriggerBase] = []
    actions: List[BPMActionBase] = []

class BPMWorkflowResponse(BPMWorkflowBase):
    id: int
    triggers: List[BPMTriggerResponse]
    actions: List[BPMActionResponse]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BPMLogResponse(BaseModel):
    id: int
    workflow_id: Optional[int]
    entity_id: int
    status: str
    message: Optional[str]
    execution_time: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
