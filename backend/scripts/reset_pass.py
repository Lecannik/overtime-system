"""
Скрипт для безопасного сброса пароля учетной записи администратора (admin@example.com).

Генерирует криптографически стойкий временный пароль и принудительно устанавливает
флаг must_change_password=True для смены пароля при первом входе.
"""

import asyncio
import os
import secrets
import sys

# Добавляем путь к приложению для корректных импортов
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal as SessionLocal
from app.core.security import hash_password
from app.models.user import User


async def main() -> None:
    """Сбрасывает пароль администратора на случайно сгенерированный временный пароль."""
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "admin@example.com"))
        user = result.scalar_one_or_none()
        if user:
            temp_password = secrets.token_urlsafe(16)
            user.hashed_password = hash_password(temp_password)
            user.must_change_password = True
            user.is_active = True
            await session.commit()
            print("✅ Пароль успешно сброшен для admin@example.com")
            print(f"🔑 Новый временный пароль: {temp_password}")
            print("⚠️ При первом входе потребуется изменить этот пароль (must_change_password=True).")
        else:
            print("❌ Пользователь admin@example.com не найден.")


if __name__ == "__main__":
    asyncio.run(main())
