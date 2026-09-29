import logging
import os

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check(request: Request, session: AsyncSession = Depends(get_session)):
    """
    Расширенный health-check системы.

    Проверяет состояние всех ключевых подсистем:
    - PostgreSQL: SELECT 1
    - Telegram Bot: запущен ли бот в app.state
    - Whisper STT: загружена ли модель (маркер-файл .models_ready)
    - MS Graph: сконфигурирован ли MSAL-клиент

    Возвращает:
        dict: Статус каждой подсистемы и общий статус (ok/degraded).
    """
    checks = {}

    # 1. Проверка базы данных
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.error("Health check: database failed — %s", e)
        checks["database"] = "error"

    # 2. Проверка Telegram-бота
    tg_bot = getattr(request.app.state, "tg_bot", None)
    checks["telegram_bot"] = "running" if tg_bot is not None else "not_configured"

    # 3. Проверка загрузки ML-моделей (Whisper STT)
    models_ready_marker = "/app/models/.models_ready"
    local_marker = os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", ".models_ready")
    whisper_ready = os.path.exists(models_ready_marker) or os.path.exists(os.path.abspath(local_marker))
    checks["whisper_model"] = "loaded" if whisper_ready else "not_loaded"

    # 4. Проверка MS Graph (MSAL-клиент инициализирован)
    try:
        from app.services.ms_graph import ms_graph

        checks["ms_graph"] = "configured" if ms_graph._app is not None else "not_configured"
    except Exception:
        checks["ms_graph"] = "not_configured"

    # Общий статус: degraded, если хотя бы одна критическая проверка упала
    overall = "ok" if checks["database"] == "ok" else "degraded"

    return {"status": overall, "checks": checks}
