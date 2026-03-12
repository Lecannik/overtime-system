import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.overtime import Overtime
from app.models.organization import Project
from app.models.user import User
from app.core.config import settings

DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:"
    f"{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def fix():
    async with AsyncSessionLocal() as session:
        # 1. Посмотрим список проектов
        res = await session.execute(select(Project))
        projects = res.scalars().all()
        print(f"Projects: {[(p.id, p.name) for p in projects]}")
        
        # 2. Посмотрим список пользователей
        res = await session.execute(select(User))
        users = res.scalars().all()
        print(f"Users: {[(u.id, u.full_name) for u in users]}")
        
        # 3. Привяжем все заявки к существующему проекту и юзеру, если они почему-то отвалились (хотя foreign key должен держать)
        # Но судя по всему они есть, просто selectinload не сработал.
        
        # 4. Проверим конкретную заявку вручную с join
        res = await session.execute(select(Overtime).limit(1))
        ot = res.scalar_one_or_none()
        if ot:
            print(f"OT ID {ot.id}: project_id={ot.project_id}, user_id={ot.user_id}")
            
            # Попробуем загрузить проект вручную
            res = await session.execute(select(Project).where(Project.id == ot.project_id))
            proj = res.scalar_one_or_none()
            print(f"Manual Project Load: {proj.name if proj else 'Not Found'}")

if __name__ == "__main__":
    asyncio.run(fix())
