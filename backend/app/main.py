import os
import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# Правильные импорты роутеров
from app.api.v1.auth import router as auth_router
from app.api.v1.overtime import router as overtime_router
from app.api.v1.admin import router as admin_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.projects import router as projects_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.audit import router as audit_router
from app.api.v1.health import router as health_router
from app.api.v1.websocket import router as websocket_router

from app.services.bot_service import run_bot_async
from app.core.config import settings

_cleanup_logger = logging.getLogger("stale_cleanup")

async def _stale_session_cleanup_loop():
    """Каждый час автоматически закрывает IN_PROGRESS сессии старше MAX_OVERTIME_HOURS."""
    from app.core.database import AsyncSessionLocal
    from app.services.overtime import auto_close_stale_sessions

    while True:
        await asyncio.sleep(3600)
        try:
            async with AsyncSessionLocal() as session:
                closed = await auto_close_stale_sessions(session)
                if closed:
                    _cleanup_logger.warning("Auto-closed %d stale IN_PROGRESS session(s)", closed)
        except Exception:
            _cleanup_logger.exception("Error in stale session cleanup task")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Обеспечиваем существование папок
    os.makedirs(os.path.abspath("uploads/voice"), exist_ok=True)

    # Фоновая задача: автозакрытие зависших IN_PROGRESS сессий
    cleanup_task = asyncio.create_task(_stale_session_cleanup_loop())

    # Запуск Telegram Бота
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if token:
        print("🤖 Запуск Telegram Бота...")
        app.state.tg_bot = await run_bot_async(token)
    else:
        print("⚠️ TELEGRAM_BOT_TOKEN не найден в .env. Бот не будет запущен.")

    yield

    # Остановка бота при завершении
    if hasattr(app.state, "tg_bot"):
        await app.state.tg_bot.updater.stop()
        await app.state.tg_bot.stop()
        await app.state.tg_bot.shutdown()

    cleanup_task.cancel()

app = FastAPI(title="Overtime System", lifespan=lifespan)

# CORS — origins берутся из ALLOWED_ORIGINS в .env (через запятую)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Раздача статики
uploads_dir = os.path.abspath("uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Роутеры
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(overtime_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(websocket_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit"])
