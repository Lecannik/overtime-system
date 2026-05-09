from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.overtime import OvertimeStatus
from app.models.user import User


class OvertimeBase(BaseModel):
    """
    Базовая схема переработки.
    Содержит общие поля для всех операций с заявками.
    """
    project_id: int
    start_time: datetime
    end_time: datetime | None = None
    description: str
    location_name: str | None = None
    timezone_offset: int | None = None  # Смещение часового пояса клиента в минутах (getTimezoneOffset())
    start_lat: float | None = None
    start_lng: float | None = None
    end_lat: float | None = None
    end_lng: float | None = None


class OvertimeCreate(OvertimeBase):
    """
    Схема для СОЗДАНИЯ новой заявки.
    Сюда попадают данные прямиком из фронтенда.
    """
    pass


class OvertimeUpdate(BaseModel):
    """
    Схема для ОБНОВЛЕНИЯ существующей заявки.
    Все поля не обязательны (Optional), так как мы можем менять только часть данных.
    """
    project_id: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    description: str | None = None
    location_name: str | None = None


class OvertimeResponse(OvertimeBase):
    """
    Схема ОТВЕТА сервера.
    То, как заявка выглядит для фронтенда. Здесь добавляются системные поля (id, status).
    """
    id: int
    user_id: int
    status: OvertimeStatus

    # Состояние согласования
    manager_approved: bool | None
    head_approved: bool | None
    manager_comment: str | None
    head_comment: str | None

    created_at: datetime
    voice_url: str | None = None
    voice_summary: str | None = None

    # Вложенные объекты (для отображения имен вместо ID)
    project: "ProjectMini | None" = None
    user: "UserMini | None" = None
    
    # Вычисляемые поля (рассчитываются на бэкенде перед отправкой)
    hours: float
    raw_hours: float
    approved_hours: float | None = None

    @field_validator("start_time", "end_time", "created_at", mode="after")
    @classmethod
    def add_utc_tz(cls, v: datetime | None) -> datetime | None:
        """Добавляет метку UTC к 'наивным' датам из базы данных для корректного парсинга фронтендом."""
        if v and v.tzinfo is None:
            from datetime import timezone
            return v.replace(tzinfo=timezone.utc)
        return v

    model_config = ConfigDict(from_attributes=True)


class OvertimeReview(BaseModel):
    """
    Схема для принятия РЕШЕНИЯ по заявке руководителем или админом.
    """
    approved: bool
    comment: str | None = None
    as_role: str | None = None
    approved_hours: float | None = None


# Вспомогательные схемы для уменьшения объема данных в ответах
class ProjectMini(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class UserMini(BaseModel):
    id: int
    full_name: str | None = None
    email: str
    model_config = ConfigDict(from_attributes=True)


# Схемы для аналитики
class ProjectHours(BaseModel):
    project_name: str
    hours: float


class DayHours(BaseModel):
    date: str
    hours: float


class PersonalStats(BaseModel):
    current_month_hours: float
    last_month_hours: float
    total_approved_hours: float
    total_requests: int
    active_requests: int
    projects_count: int
    by_project: list[ProjectHours]
    daily_stats: list[DayHours]


class PaginatedOvertimeResponse(BaseModel):
    items: list[OvertimeResponse]
    total: int
    page: int
    page_size: int
    pages: int
