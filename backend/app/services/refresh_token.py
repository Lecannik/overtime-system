import logging
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.user import User, RefreshToken

logger = logging.getLogger(__name__)


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


# Кэш в памяти для недавно отозванных токенов для предотвращения race condition на клиенте.
# Хранит: token -> (new_token, grace_expires_at, user_id)
_rotated_tokens_grace_cache = {}


async def verify_and_rotate_refresh_token(session: AsyncSession, token: str) -> tuple[str, User]:
    """
    Проверяет переданный Refresh Token и возвращает новый Refresh Token и объект пользователя.
    Реализует механизм Token Rotation: старый токен отзывается, выдается новый.
    При попытке повторного использования отозванного токена отзываются все токены пользователя.
    Включает 10-секундный Grace Period для предотвращения гонок при параллельных запросах.
    """
    now = datetime.now(timezone.utc)
    
    # 1. Проверяем Grace Period кэш в памяти
    if token in _rotated_tokens_grace_cache:
        new_token, grace_expires_at, user_id = _rotated_tokens_grace_cache[token]
        if now < grace_expires_at:
            logger.info("verify_and_rotate_refresh_token: Prevented race condition (grace period). Token %s... was rotated recently. Returning existing new token.", token[:10])
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            if user and user.is_active:
                return new_token, user
            else:
                logger.warning("verify_and_rotate_refresh_token: User not found or inactive during grace period bypass for user_id=%s", user_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Пользователь заблокирован или не найден"
                )
        else:
            del _rotated_tokens_grace_cache[token]

    # Очищаем устаревшие записи из кэша (чтобы избежать утечек памяти)
    expired_keys = [k for k, v in _rotated_tokens_grace_cache.items() if now >= v[1]]
    for k in expired_keys:
        _rotated_tokens_grace_cache.pop(k, None)

    # Ищем токен в базе
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    db_token = result.scalar_one_or_none()
    
    if not db_token:
        logger.warning("verify_and_rotate_refresh_token: Token not found in DB: %s...", token[:10] if token else "None")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный сессионный токен"
        )
        
    # Если токен уже был отозван — возможно, это атака повторного использования!
    # В целях безопасности отзываем все токены этого пользователя.
    if db_token.revoked:
        logger.error("verify_and_rotate_refresh_token: Token %s... is ALREADY revoked! Potential token reuse attack! Revoking all tokens for user_id=%s", token[:10] if token else "None", db_token.user_id)
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
    expires_aware = db_token.expires_at if db_token.expires_at.tzinfo else db_token.expires_at.replace(tzinfo=timezone.utc)
    if expires_aware < datetime.now(timezone.utc):
        logger.warning("verify_and_rotate_refresh_token: Token %s... has expired at %s (now: %s)", token[:10] if token else "None", expires_aware, datetime.now(timezone.utc))
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
        logger.warning("verify_and_rotate_refresh_token: User not found or inactive for user_id=%s", db_token.user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь заблокирован или не найден"
        )
        
    # Добавляем старый токен в Grace Period кэш
    grace_expires = datetime.now(timezone.utc) + timedelta(seconds=10)
    _rotated_tokens_grace_cache[token] = (new_token, grace_expires, db_token.user_id)
    
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
