import os
from dotenv import load_dotenv

# Загружаем переменные из корневого .env файла для успешной валидации pydantic settings
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv(dotenv_path)

import asyncio
import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import httpx

from app.core.database import Base, get_session
from app.main import app
from app.models.user import User, UserRole, UserCompany
from app.models.organization import Department, Project
from app.core.security import hash_password, create_access_token

# Используем SQLite в памяти для тестов
DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    """Создает event loop для асинхронных тестов."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def init_db():
    """Создает все таблицы перед каждым тестом и удаляет после."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Сессия базы данных для тестов."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Тестовый HTTP-клиент с подмененной базой данных."""
    async def override_get_session():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_session] = override_get_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def test_department(db_session: AsyncSession) -> Department:
    """Создает тестовый отдел."""
    dept = Department(name="Тестовый отдел")
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)
    return dept


@pytest.fixture
async def test_project(db_session: AsyncSession) -> Project:
    """Создает тестовый проект."""
    project = Project(
        name="Тестовый проект",
        code="2026-00001",
        weekly_limit=50,
        is_active=True
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Создает пользователя с ролью admin."""
    user = User(
        full_name="Администратор Тест",
        email="admin@example.com",
        hashed_password=hash_password("admin_pass"),
        role=UserRole.admin,
        company=UserCompany.Polymedia,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def normal_user(db_session: AsyncSession, test_department: Department) -> User:
    """Создает обычного пользователя."""
    user = User(
        full_name="Сотрудник Тест",
        email="employee@example.com",
        hashed_password=hash_password("user_pass"),
        role=UserRole.employee,
        company=UserCompany.Polymedia,
        department_id=test_department.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def manager_user(db_session: AsyncSession) -> User:
    """Создает пользователя с ролью manager."""
    user = User(
        full_name="Менеджер Тест",
        email="manager@example.com",
        hashed_password=hash_password("manager_pass"),
        role=UserRole.manager,
        company=UserCompany.Polymedia,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def head_user(db_session: AsyncSession, test_department: Department) -> User:
    """Создает начальника отдела."""
    user = User(
        full_name="Начальник Тест",
        email="head@example.com",
        hashed_password=hash_password("head_pass"),
        role=UserRole.head,
        company=UserCompany.Polymedia,
        department_id=test_department.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    # Делаем его начальником тестового отдела
    test_department.head_id = user.id
    db_session.add(test_department)
    await db_session.commit()
    
    return user


@pytest.fixture
async def admin_token_headers(admin_user: User) -> dict:
    """Возвращает заголовки авторизации для администратора."""
    token = create_access_token(data={"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def normal_user_token_headers(normal_user: User) -> dict:
    """Возвращает заголовки авторизации для сотрудника."""
    token = create_access_token(data={"sub": str(normal_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def manager_token_headers(manager_user: User) -> dict:
    """Возвращает заголовки авторизации для менеджера."""
    token = create_access_token(data={"sub": str(manager_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def head_token_headers(head_user: User) -> dict:
    """Возвращает заголовки авторизации для начальника отдела."""
    token = create_access_token(data={"sub": str(head_user.id)})
    return {"Authorization": f"Bearer {token}"}
