from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import hash_password, verify_password
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdatePreferences, UserChangePassword
from app.services.auth import register_user, authenticate_user
from app.core.security import create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.user import update_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, session: AsyncSession = Depends(get_session)):
    """
    Регистрация нового пользователя.
    """
    return await register_user(session, user_in)


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    """
    Аутентификация пользователя и получение JWT токена.

    В поле **username** нужно ввести email.
    Это стандарт OAuth2 — Swagger UI использует именно это поле.
    """
    user = await authenticate_user(session, form_data.username, form_data.password)
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Получить информацию о текущем авторизованном пользователе.
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_my_preferences(
    pref_in: UserUpdatePreferences,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Обновить настройки уведомлений текущего пользователя."""
    updated_user = await update_user(db, current_user, pref_in.model_dump(exclude_unset=True))
    # Рефреш уже есть в update_user, но на всякий случай...
    return updated_user


@router.post("/change-password")
async def change_password(
    pass_in: UserChangePassword,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Смена пароля текущего пользователя."""
    if not verify_password(pass_in.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный старый пароль"
        )

    await update_user(db, current_user, {
        "hashed_password": hash_password(pass_in.new_password),
        "must_change_password": False
    })
    return {"detail": "Пароль успешно изменен"}
