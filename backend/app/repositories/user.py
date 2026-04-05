from sqlalchemy import select, or_, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserCompany
from typing import Optional


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Получить пользователя по email"""

    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_chat_id(session: AsyncSession, chat_id: str) -> User | None:
    """Получить пользователя по Telegram Chat ID (только активные)"""
    result = await session.execute(
        select(User).where(User.telegram_chat_id == str(chat_id), User.is_active == True)
    )
    return result.scalars().first()

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

async def get_all_users(
    session: AsyncSession,
    search: Optional[str] = None,
    sort_by: str = "id",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 15,
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    company: Optional[str] = None
) -> dict:
    """
    Получить пользователей с пагинацией, поиском и сортировкой.
    """
    query = select(User)

    if role:
        query = query.where(User.role == role)
    if department_id:
        query = query.where(User.department_id == department_id)
    if company:
        query = query.where(User.company == company)

    # Поиск по имени и email
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )

    # Подсчет общего количества (до пагинации)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar()

    # Сортировка
    sort_column = getattr(User, sort_by, User.id)
    order_func = desc if sort_order == "desc" else asc
    query = query.order_by(order_func(sort_column))

    # Пагинация (page_size=0 означает "все записи")
    if page_size > 0:
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    items = result.scalars().all()

    pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size if page_size > 0 else total,
        "pages": pages
    }

async def delete_user(session: AsyncSession, user: User):
    """Удалить пользователя"""
    await session.delete(user)
    await session.commit()