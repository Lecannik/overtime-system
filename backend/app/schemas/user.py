"""
Модуль содержит Pydantic-схемы для валидации данных пользователей.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.models.user import UserRole
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.employee
    department_id: Optional[int] = None


class UserCreateByAdmin(UserCreate):
    pass


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: EmailStr
    role: UserRole
    department_id: Optional[int] = None
    telegram_chat_id: Optional[str] = None
    notification_level: int = 2
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime
    # Это говорит Pydantic: "Ты можешь брать данные прямо из атрибутов объекта базы данных"
    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdatePreferences(BaseModel):
    full_name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[int] = None
    department_id: Optional[int] = None


class UserAdminUpdate (BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram_chat_id: Optional[str] = None
    notification_level: Optional[int] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    department_id: Optional[int] = None

class UserChangePassword(BaseModel):
    old_password: str
    new_password: str