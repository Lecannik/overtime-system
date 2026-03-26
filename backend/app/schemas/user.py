"""
Модуль содержит Pydantic-схемы для валидации данных пользователей.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.models.user import UserRole, UserCompany
from datetime import datetime


class UserCreate(BaseModel):
    """Схема для регистрации нового пользователя."""
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.employee
    company: UserCompany = UserCompany.Polymedia
    department_id: Optional[int] = None


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
    notification_level: int = 2
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
    notification_level: Optional[int] = None
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
    notification_level: Optional[int] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    department_id: Optional[int] = None
    company: Optional[UserCompany] = None
    is_2fa_enabled: Optional[bool] = None


class UserChangePassword(BaseModel):
    old_password: str
    new_password: str