import random
import string
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import UserOTP, OTPType

async def create_otp(db: AsyncSession, user_id: int, otp_type: OTPType = OTPType.login) -> str:
    """Создает новый OTP код и сохраняет его в БД."""
    # Удаляем старые коды этого типа для этого пользователя
    await db.execute(
        delete(UserOTP).where(
            UserOTP.user_id == user_id,
            UserOTP.type == otp_type
        )
    )
    
    # Генерируем 6-значный код
    code = ''.join(random.choices(string.digits, k=6))
    
    # Срок жизни 10 минут
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    new_otp = UserOTP(
        user_id=user_id,
        code=code,
        type=otp_type,
        expires_at=expires_at
    )
    db.add(new_otp)
    await db.flush()
    return code

async def verify_otp(db: AsyncSession, user_id: int, code: str, otp_type: OTPType = OTPType.login) -> bool:
    """Проверяет OTP код."""
    result = await db.execute(
        select(UserOTP).where(
            UserOTP.user_id == user_id,
            UserOTP.code == code,
            UserOTP.type == otp_type,
            UserOTP.expires_at > datetime.now(timezone.utc)
        )
    )
    otp = result.scalar_one_or_none()
    
    if otp:
        # Одноразовый код - удаляем после использования
        await db.delete(otp)
        await db.flush()
        return True
        
    return False
