import asyncio
from app.core.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def reset_admin_2fa():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).filter(User.email == 'admin@example.com'))
        user = result.scalar_one_or_none()
        if user:
            user.is_2fa_enabled = False
            user.totp_secret = None
            await session.commit()
            print("Successfully disabled 2FA for admin@example.com")
        else:
            print("User admin@example.com not found")

if __name__ == "__main__":
    asyncio.run(reset_admin_2fa())
