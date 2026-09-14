import os
import asyncio
import logging
import sys
from contextlib import asynccontextmanager
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse
from app.api.deps import get_current_user
from app.core.database import get_session
from app.models.user import User, UserRole
from app.models.overtime import Overtime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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

app = FastAPI(
    title="Overtime System",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
)

# CORS — origins берутся из ALLOWED_ORIGINS в .env (через запятую)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Безопасная выдача файлов загрузок (требует аутентификации)
uploads_dir = os.path.abspath("uploads")
os.makedirs(os.path.join(uploads_dir, "voice"), exist_ok=True)

@app.get("/uploads/{file_path:path}")
async def get_protected_upload(
    file_path: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Безопасная выдача файлов из uploads только авторизованным пользователям.
    Защищает конфиденциальные голосовые сообщения и документы сотрудников от неавторизованного доступа:
    файл может скачать только его автор, руководитель проекта автора или администратор (BOLA / IDOR).
    """
    uploads_base = os.path.abspath("uploads")
    resolved_path = os.path.abspath(os.path.join(uploads_base, file_path))
    # Защита от Path Traversal
    if not resolved_path.startswith(uploads_base):
        raise HTTPException(status_code=400, detail="Недопустимый путь к файлу")

    if not os.path.exists(resolved_path) or not os.path.isfile(resolved_path):
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Проверка прав доступа (BOLA / IDOR):
    # Администраторам доступ открыт ко всем файлам
    if current_user.role != UserRole.admin:
        filename = os.path.basename(resolved_path)
        stmt = (
            select(Overtime)
            .options(selectinload(Overtime.project))
            .where(Overtime.voice_url.like(f"%{filename}"))
        )
        result = await session.execute(stmt)
        overtime = result.scalars().first()

        if overtime:
            is_author = overtime.user_id == current_user.id
            is_manager = (
                overtime.project is not None
                and overtime.project.manager_id == current_user.id
            )
            is_dept_head = False
            if current_user.role == UserRole.head and current_user.department_id:
                author = await session.get(User, overtime.user_id)
                if author and author.department_id == current_user.department_id:
                    is_dept_head = True

            if not (is_author or is_manager or is_dept_head):
                raise HTTPException(
                    status_code=403,
                    detail="У вас нет прав для доступа к данному файлу."
                )

    return FileResponse(resolved_path)

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
