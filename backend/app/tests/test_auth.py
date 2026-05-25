import pytest
from httpx import AsyncClient
from app.models.user import User

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, normal_user: User):
    """Тест успешного входа пользователя и выдачи Access токена."""
    login_data = {
        "username": normal_user.email,
        "password": "user_pass"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, normal_user: User):
    """Тест входа с неверным паролем."""
    login_data = {
        "username": normal_user.email,
        "password": "wrong_password"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    # Бэкенд возвращает 400 Bad Request при неверном пароле
    assert response.status_code == 400
    assert response.json()["detail"] == "Неверное имя пользователя или пароль."


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, normal_user_token_headers, normal_user: User):
    """Тест получения профиля текущего авторизованного пользователя."""
    response = await client.get("/api/v1/auth/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["email"] == normal_user.email
    assert data["full_name"] == normal_user.full_name
