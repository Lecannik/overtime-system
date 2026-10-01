from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{settings.db.user}:"
    f"{settings.db.password}@"
    f"{settings.db.host}:"
    f"{settings.db.port}/"
    f"{settings.db.db}"
)


class Base(DeclarativeBase): ...


engine = create_async_engine(
    DATABASE_URL,
    echo=settings.SQL_ECHO,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,  # проверяет соединение перед использованием
    pool_recycle=3600,  # переподключение каждый час (избегает stale connections)
)


AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session


# Алиас для совместимости
get_db = get_session
