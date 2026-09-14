from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.overtime import OvertimeStatus
from app.models.user import UserRole


class OvertimeBase(BaseModel):
    """
    Базовая схема переработки.
    Содержит общие поля для всех операций с заявками.
    """
    project_id: int
    start_time: datetime
    end_time: datetime | None = None
    description: str = Field(min_length=1, max_length=2000)
    location_name: str | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    end_lat: float | None = None
    end_lng: float | None = None


class OvertimeCreate(OvertimeBase):
    """
    Схема для СОЗДАНИЯ новой заявки.
    Сюда попадают данные прямиком из фронтенда.
    """
    @model_validator(mode="after")
    def validate_duration(self) -> "OvertimeCreate":
        """
        Защита от микросекундных манипуляций округлением (Attack 6).
        Минимальная длительность переработки составляет 15 минут (900 секунд).
        """
        if self.start_time and self.end_time:
            duration_sec = (self.end_time - self.start_time).total_seconds()
            if duration_sec < 900:
                raise ValueError("Минимальная длительность переработки составляет 15 минут.")
        return self


class OvertimeUpdate(BaseModel):
    """
    Схема для ОБНОВЛЕНИЯ существующей заявки.
    Все поля не обязательны (Optional), так как мы можем менять только часть данных.
    """
    project_id: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    description: str | None = Field(None, min_length=1, max_length=2000)
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

    # Голосовая запись и расшифровка
    voice_url: str | None = None
    voice_summary: str | None = None

    # Вложенные объекты (для отображения имен вместо ID)
    project: "ProjectMini | None" = None
    user: "UserMini | None" = None
    
    # Вычисляемые поля (рассчитываются на бэкенде перед отправкой)
    hours: float
    raw_hours: float
    approved_hours: float | None = None

    model_config = ConfigDict(from_attributes=True)


class OvertimeReview(BaseModel):
    """
    Схема для принятия РЕШЕНИЯ по заявке руководителем или админом.
    """
    approved: bool
    comment: str | None = None
    as_role: UserRole | None = None
    approved_hours: float | None = Field(default=None, gt=0, le=24.0, description="Количество согласованных часов (0 < hours <= 24.0)")


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
