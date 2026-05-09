import asyncio
import sys
import os

sys.path.append("/app")

from app.core.security import hash_password
from app.repositories.user import update_user, get_user_by_email
from app.core.database import get_session

async def run():
    try:
        async for session in get_session():
            user = await get_user_by_email(session, "admin@example.com")
            if user:
                # Обновляем пароль и активируем пользователя
                await update_user(session, user, {
                    "hashed_password": hash_password("admin123"),
                    "is_active": True,
                    "must_change_password": False
                })
                print("Password reset for admin@example.com successfully!")
            else:
                print("User admin@example.com not found")
            break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
