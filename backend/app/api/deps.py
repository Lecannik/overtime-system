from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.core.config import settings
from app.core.database import get_session
from app.models.user import User
from app.repositories.user import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Извлекает текущего пользователя из JWT-токена.
    Используется как зависимость (Depends) в защищенных эндпоинтах.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = await get_user_by_id(session, int(user_id))
    if user is None:
        raise credentials_exception

    # Если флаг установлен, разрешаем только эндпоинты профиля (GET) и смены пароля (POST)
    if user.must_change_password:
        is_allowed = (
            (request.url.path == "/api/v1/auth/me" and request.method == "GET") or
            (request.url.path == "/api/v1/auth/change-password" and request.method == "POST")
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Требуется смена пароля. Пока пароль не изменен, доступ к функциям ограничен."
            )

    return user
