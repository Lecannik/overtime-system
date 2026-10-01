import httpx
import pytest

from app.core.cache import cache_clear
from app.core.security import create_access_token
from app.models.organization import Department
from app.models.user import User


@pytest.mark.asyncio
async def test_list_departments_unauthorized(client: httpx.AsyncClient):
    """
    Проверка требования аутентификации для эндпоинта /api/v1/departments.
    Запрос без токена авторизации должен возвращать 401.
    """
    response = await client.get("/api/v1/departments")
    assert response.status_code == 401

    response_slash = await client.get("/api/v1/departments/")
    assert response_slash.status_code == 401


@pytest.mark.asyncio
async def test_list_departments_success(client: httpx.AsyncClient, normal_user: User, test_department: Department):
    """
    Проверка успешного получения списка отделов обычным авторизованным сотрудником.
    Тестируются эндпоинты как со слэшем на конце, так и без него.
    """
    cache_clear("departments")
    token = create_access_token({"sub": str(normal_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Запрос без слеша
    response = await client.get("/api/v1/departments", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(d["id"] == test_department.id for d in data)

    # Запрос со слешем (именно такой делает frontend DashboardPage)
    response_slash = await client.get("/api/v1/departments/", headers=headers)
    assert response_slash.status_code == 200
    data_slash = response_slash.json()
    assert isinstance(data_slash, list)
    assert len(data_slash) >= 1


@pytest.mark.asyncio
async def test_departments_cache_and_invalidation(client: httpx.AsyncClient, admin_user: User, normal_user: User):
    """
    Проверка кэширования списка отделов и его корректной инвалидации
    при создании нового отдела администратором.
    """
    cache_clear("departments")
    admin_token = create_access_token({"sub": str(admin_user.id)})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    user_token = create_access_token({"sub": str(normal_user.id)})
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Первоначальный запрос пользователем (кэширует)
    initial_res = await client.get("/api/v1/departments/", headers=user_headers)
    assert initial_res.status_code == 200
    initial_count = len(initial_res.json())

    # Создание нового отдела администратором
    new_dept_payload = {"name": "Новый тестовый отдел для кэша"}
    create_res = await client.post("/api/v1/admin/departments", json=new_dept_payload, headers=admin_headers)
    assert create_res.status_code == 201

    # Запрос пользователем после инвалидации кэша
    updated_res = await client.get("/api/v1/departments/", headers=user_headers)
    assert updated_res.status_code == 200
    updated_data = updated_res.json()
    assert len(updated_data) == initial_count + 1
    assert any(d["name"] == "Новый тестовый отдел для кэша" for d in updated_data)
