# pyrefly: ignore [missing-import]
import re
from pydantic import BaseModel, ConfigDict, field_validator


# --- Departments ---

class DepartmentCreate(BaseModel):
    """Схема создания отдела."""
    name: str
    head_id: int | None = None

class DepartmentUpdate(BaseModel):
    """Схема обновления отдела."""
    name: str | None = None
    head_id: int | None = None

class DepartmentResponse(BaseModel):
    """Схема ответа с данными отдела."""
    id: int
    name: str
    head_id: int | None

    model_config = ConfigDict(from_attributes=True)


# --- Projects ---

# Regex для валидации номера проекта: YYYY-NNNNN (например, 2026-00001)
_PROJECT_CODE_RE = re.compile(r"^\d{4}-\d{5}$")


class ProjectCreate(BaseModel):
    """
    Схема создания проекта.

    Поле code (номер проекта) является иммутабельным после создания
    и должно соответствовать формату YYYY-NNNNN (например, 2026-00001).
    """
    name: str
    code: str
    manager_id: int | None = None
    weekly_limit: int = 50
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def validate_code_format(cls, v: str) -> str:
        """Проверяет соответствие номера проекта формату YYYY-NNNNN."""
        v = v.strip()
        if not _PROJECT_CODE_RE.match(v):
            raise ValueError(
                "Номер проекта должен быть в формате ГГГГ-ННННН, "
                "например: 2026-00001"
            )
        return v


class ProjectUpdate(BaseModel):
    """
    Схема обновления проекта.

    Поле code (номер проекта) намеренно исключено:
    номер проекта является иммутабельным после создания.
    """
    name: str | None = None
    manager_id: int | None = None
    weekly_limit: int | None = None
    is_active: bool | None = None


class ProjectResponse(BaseModel):
    """Схема ответа с данными проекта."""
    id: int
    name: str
    code: str | None = None
    manager_id: int | None = None
    weekly_limit: int = 50
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

