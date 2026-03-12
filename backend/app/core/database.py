from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:"
    f"{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)


class Base(DeclarativeBase):
    ...


engine = create_async_engine(DATABASE_URL, echo=True)


AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_session():
    async with AsyncSessionLocal() as session:
        yield session

# Алиас для совместимости
get_db = get_session
