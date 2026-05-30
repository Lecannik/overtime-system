import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.user import User, RefreshToken


async def create_refresh_token(session: AsyncSession, user_id: int) -> str:
    """
    Генерирует и сохраняет новый Refresh Token в базе данных.
    """
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
        revoked=False
    )
    session.add(db_token)
    return token


async def verify_and_rotate_refresh_token(session: AsyncSession, token: str) -> tuple[str, User]:
    """
    Проверяет переданный Refresh Token и возвращает новый Refresh Token и объект пользователя.
    Реализует механизм Token Rotation: старый токен отзывается, выдается новый.
    При попытке повторного использования отозванного токена отзываются все токены пользователя.
    """
    # Ищем токен в базе
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    db_token = result.scalar_one_or_none()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный сессионный токен"
        )
        
    # Если токен уже был отозван — возможно, это атака повторного использования!
    # В целях безопасности отзываем все токены этого пользователя.
    if db_token.revoked:
        # Отзываем все токены пользователя
        await session.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == db_token.user_id)
            .values(revoked=True)
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия скомпрометирована. Пожалуйста, войдите снова."
        )
        
    # Проверка на истечение срока действия
    if db_token.expires_at < datetime.now(timezone.utc):
        db_token.revoked = True
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия сессии истек. Войдите снова."
        )
        
    # Отзываем текущий токен
    db_token.revoked = True
    
    # Генерируем новый токен взамен
    new_token = await create_refresh_token(session, db_token.user_id)
    
    # Получаем пользователя
    user_result = await session.execute(
        select(User).where(User.id == db_token.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь заблокирован или не найден"
        )
        
    await session.commit()
    return new_token, user


async def revoke_refresh_token(session: AsyncSession, token: str) -> None:
    """
    Отзывает указанный Refresh Token (например, при логауте).
    """
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        db_token.revoked = True
        await session.commit()
