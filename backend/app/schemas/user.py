"""
Модуль содержит Pydantic-схемы для валидации данных пользователей.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

from app.models.user import UserRole, UserCompany, NotificationLevel
from datetime import datetime


class UserCreate(BaseModel):
    """Схема для регистрации нового пользователя."""
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.employee
    company: UserCompany = UserCompany.Polymedia
    department_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен содержать не менее 8 символов")
        has_digit = any(c.isdigit() for c in v)
        has_special = any(not c.isalnum() for c in v)
        if not (has_digit or has_special):
            raise ValueError("Пароль должен содержать хотя бы одну цифру или специальный символ")
        return v


class UserCreateByAdmin(UserCreate):
    is_active: bool = True


class UserResponse(BaseModel):
    """
    Схема ответа с данными пользователя.
    Используется для передачи информации о профиле на фронтенд.
    """
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    company: UserCompany
    department_id: Optional[int] = None
    telegram_chat_id: Optional[str] = None
    notification_level: NotificationLevel = NotificationLevel.ALL
    is_active: bool
    must_change_password: bool
    is_2fa_enabled: bool
    created_at: datetime
    updated_at: datetime
    # Позволяет Pydantic инициализироваться из объектов SQLAlchemy
    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginResponse(BaseModel):
    """
    Схема ответа при попытке входа.
    Обрабатывает два сценария: прямую выдачу токена или запрос 2FA кода.
    """
    status: str = "success"  # "success" (вход разрешен) или "2fa_required"
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponse] = None
    email: Optional[str] = None # Для идентификации при 2FA


class UserUpdatePreferences(BaseModel):
    """
    Схема обновления данных пользователя.
    Используется для обновления профиля на фронтенд.
    """
    full_name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[NotificationLevel] = None
    department_id: Optional[int] = None
    is_2fa_enabled: Optional[bool] = None


class UserAdminUpdate (BaseModel):
    """
    Схема обновления данных пользователя.
    Используется для обновления профиля на фронтенд.
    """
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[NotificationLevel] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    department_id: Optional[int] = None
    company: Optional[UserCompany] = None
    is_2fa_enabled: Optional[bool] = None


class UserChangePassword(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен содержать не менее 8 символов")
        has_digit = any(c.isdigit() for c in v)
        has_special = any(not c.isalnum() for c in v)
        if not (has_digit or has_special):
            raise ValueError("Пароль должен содержать хотя бы одну цифру или специальный символ")
        return v


class PaginatedUsersResponse(BaseModel):
    """Пагинированный ответ со списком пользователей."""
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = {"from_attributes": True}