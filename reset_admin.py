from app.core.security import hash_password
from app.core.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select
import asyncio

async def reset():
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(User).filter(User.email == "admin@example.com"))
            user = result.scalar_one_or_none()
            if user:
                user.hashed_password = hash_password("admin123")
                await db.commit()
                print("Password reset successfully for admin@example.com")
            else:
                print("User admin@example.com not found")
        except Exception as e:
            print(f"Error: {e}")
            await db.rollback()
        finally:
            await db.close()

if __name__ == "__main__":
    asyncio.run(reset())
