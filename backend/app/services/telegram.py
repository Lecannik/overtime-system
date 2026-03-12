import httpx
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories import settings as settings_repo


logger = logging.getLogger(__name__)


async def send_telegram_message(session: AsyncSession, chat_id: str, text: str):
    """Отправляет сообщение в Telegram, используя токен из БД."""
    # 1. Получаем актуальный токен
    token = await settings_repo.get_setting(session, "telegram_bot_token")
    if not token:
        logger.warning("Telegram Bot Token не настроен в system_settings. Пропуск отправки.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            })
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Ошибка при отправке в Telegram: {e}")
        return False
