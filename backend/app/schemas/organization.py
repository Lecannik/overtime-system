from pydantic import BaseModel, ConfigDict


# --- Departments ---

class DepartmentCreate(BaseModel):
    name: str
    head_id: int | None = None

class DepartmentUpdate(BaseModel):
    name: str | None = None
    head_id: int | None = None

class DepartmentResponse(BaseModel):
    id: int
    name: str
    head_id: int | None

    model_config = ConfigDict(from_attributes=True)


# --- Projects ---

class ProjectCreate(BaseModel):
    name: str
    manager_id: int

class ProjectUpdate(BaseModel):
    name: str | None = None
    manager_id: int | None = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    manager_id: int

    model_config = ConfigDict(from_attributes=True)
