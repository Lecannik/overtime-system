import asyncio
from app.core.database import AsyncSessionLocal as SessionLocal
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

async def main():
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == 'admin@example.com'))
        user = result.scalar_one_or_none()
        if user:
            user.hashed_password = hash_password('admin123')
            await session.commit()
            print("Password reset successful for admin@example.com")
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(main())
