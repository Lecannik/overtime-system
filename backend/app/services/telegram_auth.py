"""
Модуль криптографической аутентификации Telegram WebApp (Mini App).

Реализует официальную спецификацию верификации initData от Telegram:
1. Вычисление secret_key через HMAC-SHA256 с ключом 'WebAppData' и токеном бота.
2. Проверка цифровой подписи hash по отсортированной строке параметров.
3. Проверка срока валидности auth_date для защиты от replay-атак.
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any
from urllib.parse import parse_qsl

logger = logging.getLogger(__name__)

# Максимально допустимый возраст данных аутентификации (24 часа)
DEFAULT_MAX_AUTH_AGE_SECONDS = 86400


class TelegramAuthError(Exception):
    """Базовое исключение для ошибок валидации данных Telegram WebApp."""

    pass


def validate_telegram_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = DEFAULT_MAX_AUTH_AGE_SECONDS,
) -> dict[str, Any]:
    """
    Проверяет криптографическую подпись initData, переданную от Telegram WebApp.

    Алгоритм верификации:
        1. Разбор query-string на пары ключ-значение.
        2. Извлечение хэша `hash`.
        3. Алфавитная сортировка оставшихся пар и конкатенация через символ переноса строки.
        4. Вычисление HMAC-SHA256 ключа: HMAC_SHA256(b"WebAppData", bot_token).
        5. Проверка хеша: HMAC_SHA256(secret_key, data_check_string) == hash.
        6. Проверка времени генерации auth_date на предмет устаревания (replay-атаки).

    Аргументы:
        init_data (str): Сырая строка данных инициализации Telegram WebApp (window.Telegram.WebApp.initData).
        bot_token (str): Секретный токен Telegram-бота из настроек окружения.
        max_age_seconds (int): Максимально допустимый возраст подписи в секундах. По умолчанию 86400 (24 ч).

    Возвращает:
        dict[str, Any]: Словарь проверенных параметров Telegram, включая распарсенный объект 'user'.

    Исключения:
        TelegramAuthError: Если подпись невалидна, строка повреждена или время auth_date истекло.
    """
    if not init_data or not bot_token:
        raise TelegramAuthError("Строка init_data и bot_token обязательны для проверки.")

    try:
        parsed_pairs = parse_qsl(init_data, keep_blank_values=True)
    except Exception as exc:
        raise TelegramAuthError(f"Ошибка парсинга строки initData: {exc}") from exc

    data_dict = dict(parsed_pairs)

    if "hash" not in data_dict:
        raise TelegramAuthError("В переданных данных отсутствует обязательный параметр 'hash'.")

    received_hash = data_dict.pop("hash")

    # Формируем data_check_string: алфавитная сортировка пар key=value через \n
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(data_dict.items()))

    # 1. Вычисляем secret_key = HMAC_SHA256(b"WebAppData", bot_token)
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()

    # 2. Вычисляем expected_hash = HMAC_SHA256(secret_key, data_check_string)
    expected_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    # 3. Безопасное сравнение хешей (защита от атак по времени)
    if not hmac.compare_digest(expected_hash, received_hash):
        logger.warning("Несовпадение цифровой подписи Telegram WebApp hash.")
        raise TelegramAuthError("Недействительная цифровая подпись данных Telegram.")

    # 4. Проверка времени формирования auth_date (защита от Replay-атак)
    auth_date_str = data_dict.get("auth_date")
    if not auth_date_str or not auth_date_str.isdigit():
        raise TelegramAuthError("Отсутствует или некорректен параметр 'auth_date'.")

    auth_date = int(auth_date_str)
    current_timestamp = int(time.time())

    if max_age_seconds > 0 and (current_timestamp - auth_date > max_age_seconds):
        logger.warning(
            "Устаревшие данные Telegram initData: auth_date=%d, current=%d, delta=%d > max=%d",
            auth_date,
            current_timestamp,
            current_timestamp - auth_date,
            max_age_seconds,
        )
        raise TelegramAuthError("Срок действия данных авторизации Telegram истёк (replay-атака).")

    # 5. Парсим JSON объекта 'user', если он присутствует
    result: dict[str, Any] = dict(data_dict)
    if "user" in result:
        try:
            result["user"] = json.loads(result["user"])
        except json.JSONDecodeError as exc:
            raise TelegramAuthError("Некорректный формат JSON в поле 'user'.") from exc

    return result
