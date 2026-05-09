"""
Модуль содержит Pydantic-схемы для валидации данных пользователей.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.models.user import UserCompany, TwoFAMethod


class UserCreate(BaseModel):
    """Схема для регистрации нового пользователя."""
    full_name: str
    email: EmailStr
    password: str
    role: str = "employee"
    company: UserCompany = UserCompany.Polymedia
    department_id: Optional[int] = None
    position_id: Optional[int] = None


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
    role: str
    company: UserCompany
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    
    # Расширенные поля
    department_name: Optional[str] = None
    position_name: Optional[str] = None
    
    telegram_chat_id: Optional[str] = None
    notification_level: int = 2
    is_active: bool
    must_change_password: bool
    is_2fa_enabled: bool
    two_fa_method: TwoFAMethod = TwoFAMethod.email
    created_at: datetime
    updated_at: datetime
    permissions: list[str] = []
    
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
    """
    status: str = "success"  # "success" (вход разрешен) или "2fa_required"
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponse] = None
    email: Optional[str] = None # Для идентификации при 2FA


class UserUpdatePreferences(BaseModel):
    """
    Схема обновления данных пользователя.
    """
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[int] = None
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    is_2fa_enabled: Optional[bool] = None
    two_fa_method: Optional[TwoFAMethod] = None


class UserAdminUpdate (BaseModel):
    """
    Схема обновления данных пользователя администратором.
    """
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[int] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    company: Optional[UserCompany] = None
    is_2fa_enabled: Optional[bool] = None
    two_fa_method: Optional[TwoFAMethod] = None


class UserChangePassword(BaseModel):
    old_password: str
    new_password: str


class PaginatedUsersResponse(BaseModel):
    """Пагинированный ответ со списком пользователей."""
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = {"from_attributes": True}


class PermissionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: list[PermissionResponse] = []
    model_config = {"from_attributes": True}


class RolePermissionsSync(BaseModel):
    permission_ids: list[int]
