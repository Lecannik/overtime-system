import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
import os

# Прямо пропишем URL для теста, если .env не грузится нормально
# В прошлый раз gaierror был на 'db', попробуем 'localhost' или '127.0.0.1'
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/overtime_db"

from app.models.overtime import Overtime
from app.models.organization import Project
from app.models.user import User

async def test():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        query = select(Overtime).options(
            selectinload(Overtime.project),
            selectinload(Overtime.user)
        ).limit(3)
        
        result = await session.execute(query)
        overtimes = result.scalars().all()
        
        print(f"Loaded {len(overtimes)} overtimes")
        for ot in overtimes:
            print(f"ID {ot.id}: project={ot.project.name if ot.project else 'None'}, user={ot.user.full_name if ot.user else 'None'}")

if __name__ == "__main__":
    asyncio.run(test())
