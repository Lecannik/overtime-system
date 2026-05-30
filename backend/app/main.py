import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Обеспечиваем существование папок
    os.makedirs(os.path.abspath("uploads/voice"), exist_ok=True)
    
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
