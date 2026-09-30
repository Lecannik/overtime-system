"""
Тесты криптографической валидации Telegram WebApp initData.
"""

import hashlib
import hmac
import json
import time

import pytest

from app.services.telegram_auth import TelegramAuthError, validate_telegram_init_data


def generate_valid_init_data(bot_token: str, user_data: dict, auth_date: int | None = None) -> str:
    """Вспомогательная функция для генерации корректно подписанной строки initData."""
    if auth_date is None:
        auth_date = int(time.time())

    params = {
        "auth_date": str(auth_date),
        "query_id": "AAHdF6IQAAAAAN0XohDhr123",
        "user": json.dumps(user_data, separators=(",", ":")),
    }

    # Сортируем пары по алфавиту
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))

    # secret_key = HMAC_SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    # Собираем query string
    from urllib.parse import urlencode

    query_params = dict(params)
    query_params["hash"] = calculated_hash
    return urlencode(query_params)


def test_validate_telegram_init_data_success():
    """Тест успешной валидации подписи Telegram initData."""
    token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    user_payload = {"id": 987654321, "first_name": "Тест", "username": "testuser"}
    init_data = generate_valid_init_data(token, user_payload)

    result = validate_telegram_init_data(init_data, token)

    assert "user" in result
    assert result["user"]["id"] == 987654321
    assert result["user"]["first_name"] == "Тест"
    assert result["user"]["username"] == "testuser"
    assert "auth_date" in result


def test_validate_telegram_init_data_invalid_hash():
    """Тест отклонения данных с поддельным хешем."""
    token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    user_payload = {"id": 987654321, "first_name": "Тест"}
    init_data = generate_valid_init_data(token, user_payload)

    # Подделываем хеш
    tampered = init_data.replace("hash=", "hash=deadbeef00000000")

    with pytest.raises(TelegramAuthError, match="Недействительная цифровая подпись"):
        validate_telegram_init_data(tampered, token)


def test_validate_telegram_init_data_tampered_payload():
    """Тест: изменение данных пользователя делает подпись невалидной."""
    token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    user_payload = {"id": 987654321, "first_name": "Тест"}
    init_data = generate_valid_init_data(token, user_payload)

    # Пытаемся подменить id пользователя на чужой
    tampered = init_data.replace("987654321", "111111111")

    with pytest.raises(TelegramAuthError, match="Недействительная цифровая подпись"):
        validate_telegram_init_data(tampered, token)


def test_validate_telegram_init_data_expired():
    """Тест отклонения устаревших данных (защита от replay-атак)."""
    token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    user_payload = {"id": 987654321, "first_name": "Тест"}
    # Дата 2 дня назад (> 86400 секунд)
    old_date = int(time.time()) - 172800
    init_data = generate_valid_init_data(token, user_payload, auth_date=old_date)

    with pytest.raises(TelegramAuthError, match="Срок действия данных авторизации Telegram истёк"):
        validate_telegram_init_data(init_data, token, max_age_seconds=86400)


def test_validate_telegram_init_data_missing_hash():
    """Тест: ошибка при отсутствии параметра hash."""
    token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    with pytest.raises(TelegramAuthError, match="отсутствует обязательный параметр 'hash'"):
        validate_telegram_init_data("query_id=123&auth_date=1700000000", token)


@pytest.mark.asyncio
async def test_telegram_webapp_auth_endpoint_authenticated(client, db_session, normal_user, monkeypatch):
    """Тест эндпоинта /auth/telegram/webapp для привязанного пользователя."""
    test_bot_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr("app.core.config.settings.TELEGRAM_BOT_TOKEN", test_bot_token)

    # Привязываем telegram_chat_id к normal_user
    normal_user.telegram_chat_id = "777888999"
    db_session.add(normal_user)
    await db_session.commit()

    init_data = generate_valid_init_data(test_bot_token, {"id": 777888999, "first_name": "Test User"})

    response = await client.post("/api/v1/auth/telegram/webapp", json={"init_data": init_data})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "authenticated"
    assert data["authenticated"] is True
    assert data["access_token"] is not None
    assert data["user"]["id"] == normal_user.id
    assert data["user"]["email"] == normal_user.email


@pytest.mark.asyncio
async def test_telegram_webapp_auth_endpoint_link_required(client, monkeypatch):
    """Тест: для непривязанного Telegram ID возвращается статус link_required."""
    test_bot_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr("app.core.config.settings.TELEGRAM_BOT_TOKEN", test_bot_token)

    init_data = generate_valid_init_data(test_bot_token, {"id": 999111222, "first_name": "New User"})

    response = await client.post("/api/v1/auth/telegram/webapp", json={"init_data": init_data})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "link_required"
    assert data["authenticated"] is False
    assert data["telegram_id"] == 999111222
    assert data["access_token"] is None


@pytest.mark.asyncio
async def test_telegram_link_endpoint_success(client, db_session, normal_user, monkeypatch):
    """Тест эндпоинта /auth/telegram/link: связывание Telegram ID с аккаунтом."""
    test_bot_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr("app.core.config.settings.TELEGRAM_BOT_TOKEN", test_bot_token)

    init_data = generate_valid_init_data(test_bot_token, {"id": 888777666, "first_name": "Linked User"})

    response = await client.post(
        "/api/v1/auth/telegram/link",
        json={
            "init_data": init_data,
            "email": normal_user.email,
            "password": "user_pass",
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "authenticated"
    assert data["authenticated"] is True
    assert data["access_token"] is not None
    assert data["user"]["id"] == normal_user.id
