from datetime import datetime
from pydantic import BaseModel, ConfigDict
import enum

class OvertimeStatus(str, enum.Enum):
    PENDING = "PENDING"

class ProjectMini(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class UserMini(BaseModel):
    id: int
    full_name: str | None = None
    email: str
    model_config = ConfigDict(from_attributes=True)

class OvertimeResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    status: OvertimeStatus
    project: ProjectMini | None = None
    user: UserMini | None = None
    model_config = ConfigDict(from_attributes=True)

class MockObj:
    pass

ot = MockObj()
ot.id = 1
ot.project_id = 10
ot.user_id = 100
ot.status = OvertimeStatus.PENDING

p = MockObj()
p.id = 10
p.name = "Test Project"
ot.project = p

u = MockObj()
u.id = 100
u.full_name = "Test User"
u.email = "test@example.com"
ot.user = u

resp = OvertimeResponse.model_validate(ot)
print(resp.model_dump())
