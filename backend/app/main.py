import os
import asyncio
import logging
from contextlib import asynccontextmanager

# Настройка логирования
logging.basicConfig(level=logging.INFO)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Обеспечиваем существование папок
    os.makedirs("uploads/voice", exist_ok=True)
    
    # Импорты внутри lifespan для предотвращения циклов на этапе загрузки модуля
    from app.services.bot_service import run_bot_async
    from app.services.cleanup_service import setup_cleanup_scheduler
    from app.services.bpm_worker import run_bpm_worker_loop
    from app.core.database import AsyncSessionLocal
    from app.core.seed import seed_crm_stages, seed_roles_and_permissions, seed_task_types, seed_task_statuses, seed_bpm_workflows
    
    print("Initializing services...")
    async with AsyncSessionLocal() as db:
        try:
            await seed_crm_stages(db)
            await seed_roles_and_permissions(db)
            await seed_task_types(db)
            await seed_task_statuses(db)
            await seed_bpm_workflows(db)
            logger.info("✅ Database seeding completed successfully")
        except Exception as e:
            logger.error(f"❌ Error during database seeding: {e}")
            # Не останавливаем приложение, если сидирование не удалось
            pass
    
    # Запуск фонового воркера BPM
    asyncio.create_task(run_bpm_worker_loop())
    
    # Задача 1: Запуск бота
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if token:
        async def delayed_bot_start():
            try:
                await asyncio.sleep(5)  # Даем больше времени старому инстансу на выход
                logger.info("🤖 Запуск Telegram-бота...")
                await run_bot_async(token)
            except Exception as e:
                logger.error(f"❌ Ошибка при запуске Telegram-бота: {e}")
        
        asyncio.create_task(delayed_bot_start())
    else:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN не найден в .env. Бот не будет запущен.")
    
    # Задача 2: Запуск планировщика очистки
    logger.info("🧹 Инициализация фоновой очистки данных...")
    setup_cleanup_scheduler()
    
    yield
    
    # Остановка бота при завершении
    if hasattr(app.state, "tg_bot"):
        try:
            await app.state.tg_bot.updater.stop()
            await app.state.tg_bot.stop()
            await app.state.tg_bot.shutdown()
        except:
            pass

app = FastAPI(title="Overtime System", lifespan=lifespan)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача статики
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Роутеры
def include_routers(app: FastAPI):
    from app.api.v1.auth import router as auth_router
    from app.api.v1.overtime import router as overtime_router
    from app.api.v1.admin import router as admin_router
    from app.api.v1.analytics import router as analytics_router
    from app.api.v1.projects import router as projects_router
    from app.api.v1.crm import router as crm_router
    from app.api.v1.tasks import router as tasks_router
    from app.api.v1.notifications import router as notifications_router
    from app.api.v1.audit import router as audit_router
    from app.api.v1.bpm import router as bpm_router
    from app.api.v1.health import router as health_router
    from app.api.v1.users import router as users_router

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(overtime_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(crm_router, prefix="/api/v1")
    app.include_router(tasks_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit"])
    app.include_router(bpm_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")

include_routers(app)
