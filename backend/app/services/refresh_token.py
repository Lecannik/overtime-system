import asyncio
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


# Кэш в памяти для недавно отозванных и обновляемых токенов.
# Предотвращает race condition при параллельных запросах со стороны клиента.
# Структура:
# {
#     token_str: {
#         "event": asyncio.Event,            # Асинхронное событие для ожидания завершения транзакции
#         "grace_expires_at": datetime,     # Время жизни записи в кэше
#         "result": tuple[str, User] | Exception | None  # Результат ротации (токен, пользователь) или ошибка
#     }
# }
_rotated_tokens_grace_cache = {}


async def verify_and_rotate_refresh_token(session: AsyncSession, token: str) -> tuple[str, User]:
    """
    Проверяет переданный Refresh Token и возвращает новый Refresh Token и объект пользователя.
    Реализует механизм Token Rotation: старый токен отзывается, выдается новый.
    При попытке повторного использования отозванного токена отзываются все токены пользователя.
    Включает 10-секундный Grace Period для предотвращения гонок при параллельных запросах.

    Синхронизирует параллельные запросы в рамках одного процесса с помощью asyncio.Event,
    что исключает ложное срабатывание защиты от повторного использования (Token Reuse Attack).

    Аргументы:
        session (AsyncSession): Асинхронная сессия SQLAlchemy для работы с БД.
        token (str): Проверяемый refresh-токен в виде строки.

    Возвращает:
        tuple[str, User]: Кортеж из нового refresh-токена (строка) и объекта пользователя.

    Исключения:
        HTTPException (401): Если токен недействителен, просрочен, отозван или пользователь не найден/неактивен.
    """
    now = datetime.now(timezone.utc)
    
    # 1. Проверяем Grace Period / состояние ротации в памяти
    if token in _rotated_tokens_grace_cache:
        entry = _rotated_tokens_grace_cache[token]
        if now < entry["grace_expires_at"]:
            logger.info(
                "verify_and_rotate_refresh_token: Обнаружен параллельный запрос или недавняя ротация токена %s... Ожидаем результат.",
                token[:10]
            )
            # Ждем завершения первой транзакции
            await entry["event"].wait()
            
            # Если первый запрос завершился ошибкой, пробрасываем её же
            if isinstance(entry["result"], Exception):
                raise entry["result"]
            
            if entry["result"] is not None:
                logger.info(
                    "verify_and_rotate_refresh_token: Параллельный запрос успешно разрешен с использованием токена %s...",
                    token[:10]
                )
                return entry["result"]
        else:
            _rotated_tokens_grace_cache.pop(token, None)

    # Очищаем устаревшие записи из кэша (чтобы избежать утечек памяти)
    expired_keys = [k for k, v in _rotated_tokens_grace_cache.items() if now >= v["grace_expires_at"]]
    for k in expired_keys:
        _rotated_tokens_grace_cache.pop(k, None)

    # Инициализируем событие блокировки для текущего токена в кэше до начала асинхронных операций
    event = asyncio.Event()
    grace_expires = now + timedelta(seconds=10)
    _rotated_tokens_grace_cache[token] = {
        "event": event,
        "grace_expires_at": grace_expires,
        "result": None
    }

    try:
        # Ищем токен в базе
        result = await session.execute(
            select(RefreshToken).where(RefreshToken.token == token)
        )
        db_token = result.scalar_one_or_none()
        
        if not db_token:
            logger.warning("verify_and_rotate_refresh_token: Токен не найден в БД: %s...", token[:10] if token else "None")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный сессионный токен"
            )
            
        # Если токен уже был отозван — возможно, это атака повторного использования!
        # В целях безопасности отзываем все токены этого пользователя.
        if db_token.revoked:
            logger.error(
                "verify_and_rotate_refresh_token: Токен %s... УЖЕ отозван! Возможна атака повторного использования. Отзываем все токены для user_id=%s",
                token[:10] if token else "None",
                db_token.user_id
            )
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
        if expires_aware < now:
            logger.warning("verify_and_rotate_refresh_token: Токен %s... истек в %s (текущее время: %s)", token[:10] if token else "None", expires_aware, now)
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
            logger.warning("verify_and_rotate_refresh_token: Пользователь не найден или неактивен для user_id=%s", db_token.user_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь заблокирован или не найден"
            )
            
        await session.commit()
        
        # Сохраняем успешный результат ротации в кэш для параллельных запросов
        _rotated_tokens_grace_cache[token]["result"] = (new_token, user)
        return new_token, user

    except Exception as exc:
        # Сохраняем исключение в кэш, чтобы параллельные запросы тоже получили его
        if token in _rotated_tokens_grace_cache:
            _rotated_tokens_grace_cache[token]["result"] = exc
        raise
    finally:
        # Сигнализируем всем ожидающим корутинам, что обработка завершена
        if token in _rotated_tokens_grace_cache:
            _rotated_tokens_grace_cache[token]["event"].set()


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
