from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user import get_user_by_email, create_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


async def register_user(session: AsyncSession, user_in: UserCreate):
    """
    Регистрирует нового пользователя.

    Args:
        session: Асинхронная сессия SQLAlchemy.
        user_in: Данные нового пользователя.

    Returns:
        Созданная модель пользователя.

    Raises:
        HTTPException: Если пользователь с таким email уже существует.
    """
    # 1. Ждем результат от БД (добавляем await)
    db_user = await get_user_by_email(session, user_in.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким Email уже существует")

    # 2. Хешируем пароль
    hashed_pwd = hash_password(user_in.password)

    # 3. Создаем объект модели (переводим из Pydantic в SQLAlchemy)
    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_pwd,
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=getattr(user_in, "is_active", True)
    )

    # 4. Сохраняем (добавляем await)
    return await create_user(session, new_user)


async def authenticate_user(session: AsyncSession, email: str, password: str):
    """
    Аутентифицирует пользователя по email и паролю.

    Args:
        session: Асинхронная сессия SQLAlchemy.
        email: Email пользователя.
        password: Пароль пользователя.

    Returns:
        Найденная модель пользователя.

    Raises:
        HTTPException: Если пользователь не найден или пароль неверный.
    """
    user = await get_user_by_email(session, email)

    if user is None:
        raise HTTPException(status_code=400, detail='Неверное имя пользователя или пароль.')

    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail='Неверное имя пользователя или пароль.')

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Ваша учетная запись отключена. Обратитесь к администратору.")

    return user
