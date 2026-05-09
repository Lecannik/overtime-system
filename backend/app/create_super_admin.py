import asyncio
import sys
import os

sys.path.append("/app")

from app.core.security import hash_password
from app.models.user import User, UserCompany
from app.core.database import get_session

async def run():
    try:
        async for session in get_session():
            # Создаем нового админа
            new_admin = User(
                email="new_admin@example.com",
                full_name="Global Admin",
                hashed_password=hash_password("admin123"),
                role="admin",
                is_active=True,
                company=UserCompany.Polymedia
            )
            session.add(new_admin)
            await session.commit()
            print("New admin created: new_admin@example.com / admin123")
            break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
