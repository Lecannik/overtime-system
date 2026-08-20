"""
Тесты модуля аутентификации, авторизации и управления сессиями (Auth & SSO).
"""

from unittest.mock import patch, AsyncMock
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole, UserCompany, UserOTP, OTPType, RefreshToken
from app.services.refresh_token import create_refresh_token
from app.services.otp import create_otp


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, normal_user: User):
    """
    Тест успешного входа пользователя и выдачи Access токена и Refresh Token в Cookie.
    """
    login_data = {
        "username": normal_user.email,
        "password": "user_pass"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "refresh_token" in response.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, normal_user: User):
    """
    Тест входа с неверным паролем (ожидается HTTP 400 Bad Request).
    """
    login_data = {
        "username": normal_user.email,
        "password": "wrong_password"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "Неверное имя пользователя или пароль."


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db_session: AsyncSession):
    """
    Тест блокировки входа для деактивированного пользователя (HTTP 403 Forbidden).
    """
    user = User(
        full_name="Заблокированный пользователь",
        email="blocked@example.com",
        hashed_password=hash_password("password123"),
        role=UserRole.employee,
        company=UserCompany.Polymedia,
        is_active=False
    )
    db_session.add(user)
    await db_session.commit()

    login_data = {
        "username": "blocked@example.com",
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 403
    assert "отключена" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_with_2fa(client: AsyncClient, db_session: AsyncSession):
    """
    Тест полного цикла двухфакторной аутентификации (2FA):
    1. Попытка входа пользователя с is_2fa_enabled=True -> получение 2fa_required.
    2. Валидация неверного кода OTP -> HTTP 400.
    3. Валидация корректного кода OTP -> успешный выпуск токенов.
    """
    user = User(
        full_name="2FA Пользователь",
        email="2fa_user@example.com",
        hashed_password=hash_password("secret_pass"),
        role=UserRole.employee,
        company=UserCompany.Polymedia,
        is_active=True,
        is_2fa_enabled=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    with patch("app.services.ms_graph.ms_graph.send_email", new_callable=AsyncMock) as mock_send_email:
        mock_send_email.return_value = True
        
        # 1. Запрос логина
        login_resp = await client.post(
            "/api/v1/auth/login",
            data={"username": user.email, "password": "secret_pass"}
        )
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert data["status"] == "2fa_required"
        assert data["email"] == user.email
        assert mock_send_email.called

    # 2. Неверный OTP код
    invalid_verify_resp = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"email": user.email, "code": "000000"}
    )
    assert invalid_verify_resp.status_code == 400

    # Получаем сгенерированный в базе OTP
    otp_res = await db_session.execute(
        select(UserOTP).where(UserOTP.user_id == user.id, UserOTP.type == OTPType.login)
    )
    otp_entry = otp_res.scalars().first()
    assert otp_entry is not None

    # 3. Корректный OTP код
    valid_verify_resp = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"email": user.email, "code": otp_entry.code}
    )
    assert valid_verify_resp.status_code == 200
    res_data = valid_verify_resp.json()
    assert res_data["status"] == "success"
    assert "access_token" in res_data
    assert "refresh_token" in valid_verify_resp.cookies


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient, normal_user: User, db_session: AsyncSession):
    """
    Тест ротации Refresh токена:
    При вызове /auth/refresh старый токен отзывается, возвращается новый токен и обновленная кука.
    """
    # Создаем исходный Refresh Token
    initial_token = await create_refresh_token(db_session, normal_user.id)
    await db_session.commit()

    # Выполняем запрос с кукой refresh_token
    client.cookies.set("refresh_token", initial_token)
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "success"
    assert "access_token" in data
    
    # Проверяем, что в куках установлен новый токен
    new_cookie_token = response.cookies.get("refresh_token")
    assert new_cookie_token is not None
    assert new_cookie_token != initial_token

    # Проверяем, что старый токен в БД помечен как revoked=True
    old_token_res = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == initial_token)
    )
    old_token_record = old_token_res.scalar_one_or_none()
    assert old_token_record is not None
    assert old_token_record.revoked is True


@pytest.mark.asyncio
async def test_refresh_token_reuse_detection(client: AsyncClient, normal_user: User, db_session: AsyncSession):
    """
    Тест защиты от повторного использования отозванного токена (Token Reuse Attack):
    Попытка использовать отозванный токен приводит к инвалидации всех токенов пользователя.
    """
    # Создаем два токена: один отозванный, один активный
    revoked_token = await create_refresh_token(db_session, normal_user.id)
    active_token = await create_refresh_token(db_session, normal_user.id)
    await db_session.commit()

    # Помечаем первый токен как отозванный вручную
    token_res = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == revoked_token)
    )
    t_obj = token_res.scalar_one()
    t_obj.revoked = True
    await db_session.commit()

    # Пытаемся отправить отозванный токен
    client.cookies.set("refresh_token", revoked_token)
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert "скомпрометирована" in response.json()["detail"]

    # Проверяем, что активный токен тоже был отозван
    active_res = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == active_token)
    )
    active_record = active_res.scalar_one()
    assert active_record.revoked is True


@pytest.mark.asyncio
async def test_logout_revokes_token(client: AsyncClient, normal_user: User, db_session: AsyncSession):
    """
    Тест завершения сессии (Logout):
    Токен в БД помечается как revoked, сессионная кука удаляется.
    """
    token = await create_refresh_token(db_session, normal_user.id)
    await db_session.commit()

    client.cookies.set("refresh_token", token)
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 200

    # Проверяем отзыв токена в БД
    token_res = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    token_entry = token_res.scalar_one()
    assert token_entry.revoked is True


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, normal_user: User, normal_user_token_headers):
    """
    Тест смены пароля авторизованным пользователем.
    """
    # 1. Смена с неверным старым паролем
    bad_resp = await client.post(
        "/api/v1/auth/change-password",
        headers=normal_user_token_headers,
        json={"old_password": "wrong_old_pass", "new_password": "new_secure_password_123"}
    )
    assert bad_resp.status_code == 400

    # 2. Успешная смена пароля
    good_resp = await client.post(
        "/api/v1/auth/change-password",
        headers=normal_user_token_headers,
        json={"old_password": "user_pass", "new_password": "new_secure_password_123"}
    )
    assert good_resp.status_code == 200
    assert good_resp.json()["detail"] == "Пароль успешно изменен"

    # 3. Вход с новым паролем
    new_login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": normal_user.email, "password": "new_secure_password_123"}
    )
    assert new_login_resp.status_code == 200


@pytest.mark.asyncio
async def test_password_reset_flow(client: AsyncClient, normal_user: User, db_session: AsyncSession):
    """
    Тест процесса восстановления пароля через Email OTP.
    """
    with patch("app.services.ms_graph.ms_graph.send_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        
        # 1. Запрос на сброс пароля
        req_resp = await client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": normal_user.email}
        )
        assert req_resp.status_code == 200
        assert mock_send.called

    # Находим OTP в базе
    otp_res = await db_session.execute(
        select(UserOTP).where(UserOTP.user_id == normal_user.id, UserOTP.type == OTPType.password_reset)
    )
    otp_entry = otp_res.scalars().first()
    assert otp_entry is not None

    # 2. Подтверждение сброса с новым паролем
    confirm_resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "email": normal_user.email,
            "code": otp_entry.code,
            "new_password": "brand_new_pass_999"
        }
    )
    assert confirm_resp.status_code == 200

    # 3. Проверка успешного входа
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": normal_user.email, "password": "brand_new_pass_999"}
    )
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_microsoft_login_redirect(client: AsyncClient):
    """
    Тест генерации ссылки авторизации OIDC и сохранения state в защищенную куку.
    """
    with patch("app.core.config.settings.AUTHENTIK_BASE_URL", "https://auth.example.com"), \
         patch("app.core.config.settings.AUTHENTIK_CLIENT_ID", "test-client-id"), \
         patch("app.core.config.settings.AUTHENTIK_REDIRECT_URI", "https://app.example.com/api/v1/auth/microsoft/callback"):
        
        response = await client.get("/api/v1/auth/microsoft/login", follow_redirects=False)
        assert response.status_code == 307
        assert "oauth_state" in response.cookies
        
        location = response.headers.get("location")
        assert location.startswith("https://auth.example.com/application/o/authorize/")
        assert "client_id=test-client-id" in location


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, normal_user_token_headers, normal_user: User):
    """
    Тест получения профиля текущего авторизованного пользователя.
    """
    response = await client.get("/api/v1/auth/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["email"] == normal_user.email
    assert data["full_name"] == normal_user.full_name
