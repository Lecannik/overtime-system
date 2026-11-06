import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import OTPType, UserOTP


def hash_otp_code(code: str) -> str:
    """
    Вычисляет криптографический SHA-256 хеш OTP-кода для безопасного хранения в БД.

    Args:
        code (str): Исходный сырой 6-значный OTP-код.

    Returns:
        str: Hex-строка SHA-256 дайджеста длиной 64 символа.
    """
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


async def create_otp(db: AsyncSession, user_id: int, otp_type: OTPType = OTPType.login) -> str:
    """
    Создает новый OTP код, хеширует его через SHA-256 и сохраняет хеш в БД.

    Args:
        db (AsyncSession): Сессия базы данных.
        user_id (int): Идентификатор пользователя.
        otp_type (OTPType): Тип одноразового кода (login или password_reset).

    Returns:
        str: Исходный открытый 6-значный код для отправки пользователю (по почте или в Telegram).
    """
    # Удаляем старые коды этого типа для этого пользователя
    await db.execute(delete(UserOTP).where(UserOTP.user_id == user_id, UserOTP.type == otp_type))

    # Генерируем 6-значный код
    code = "".join(secrets.choice(string.digits) for _ in range(6))

    # Срок жизни 10 минут
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # В БД сохраняем исключительно криптографический хеш
    code_hash = hash_otp_code(code)
    new_otp = UserOTP(user_id=user_id, code=code_hash, type=otp_type, expires_at=expires_at)
    db.add(new_otp)
    await db.flush()
    return code


async def verify_otp(db: AsyncSession, user_id: int, code: str, otp_type: OTPType = OTPType.login) -> bool:
    """
    Проверяет OTP код с ограничением в 5 попыток через безопасное сравнение SHA-256 хешей.

    Args:
        db (AsyncSession): Сессия базы данных.
        user_id (int): Идентификатор пользователя.
        code (str): Введенный пользователем 6-значный код.
        otp_type (OTPType): Тип одноразового кода.

    Returns:
        bool: True, если код верен и успешно активирован; False, если код неверен (но лимит попыток не исчерпан).

    Raises:
        HTTPException: 400 Bad Request, если исчерпан лимит из 5 попыток ввода.
    """
    result = await db.execute(
        select(UserOTP).where(
            UserOTP.user_id == user_id, UserOTP.type == otp_type, UserOTP.expires_at > datetime.now(timezone.utc)
        )
    )
    otp = result.scalar_one_or_none()

    if not otp:
        return False

    code_hash = hash_otp_code(code)
    if secrets.compare_digest(otp.code, code_hash):
        # Успешный ввод - удаляем одноразовый код
        await db.delete(otp)
        await db.flush()
        return True
    else:
        # Неверный код - инкрементируем попытки и фиксируем в БД (защита от rollback при 400)
        otp.attempts += 1
        if otp.attempts >= 5:
            # Превышен лимит попыток - удаляем скомпрометированный код и фиксируем транзакцию
            await db.delete(otp)
            await db.commit()
            raise HTTPException(
                status_code=400, detail="Превышено максимальное число попыток ввода кода. Запросите новый код."
            )
        else:
            await db.commit()
            return False
