import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import settings as settings_repo

logger = logging.getLogger(__name__)


async def send_telegram_message(session: AsyncSession, chat_id: str, text: str, reply_markup: dict | None = None):
    """
    Отправляет сообщение в Telegram, используя токен из БД с fallback на env.
    Поддерживает опциональную передачу reply_markup (инлайн/обычные клавиатуры, WebApp кнопки).
    """
    import os

    # 1. Получаем актуальный токен
    token = await settings_repo.get_setting(session, "telegram_bot_token")
    if not token:
        token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("Telegram Bot Token не настроен в system_settings и не найден в .env. Пропуск отправки.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Ошибка при отправке в Telegram: {e}")
        return False
