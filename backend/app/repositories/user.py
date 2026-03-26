from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserCompany


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Получить пользователя по email"""

    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(session: AsyncSession, user: User) -> User:
    """Создать пользователя"""

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    """Получить пользователя по ID"""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_company(session: AsyncSession, company: UserCompany) -> list[User]:
    """Получить всех пользователей по компании"""
    result = await session.execute(select(User).where(User.company == company))
    return result.scalars().all()

async def update_user(session: AsyncSession, user: User, update_data: dict) -> User:
    """Обновить пользователя"""
    for key, value in update_data.items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    return user

async def get_all_users(session: AsyncSession) -> list[User]:
    """Получить всех пользователей"""

    result = await session.execute(select(User))
    return result.scalars().all()

async def delete_user(session: AsyncSession, user: User):
    """Удалить пользователя"""
    await session.delete(user)
    await session.commit()