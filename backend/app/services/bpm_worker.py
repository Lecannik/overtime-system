import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.bpm import BPMWorkflow, BPMTrigger, TriggerType
from app.services.bpm_service import BPMService
from app.models.crm import Lead, Deal
from app.models.organization import Project

logger = logging.getLogger(__name__)

async def run_bpm_worker_loop():
    """
    Бесконечный цикл для проверки временных триггеров BPM (Background Worker).
    
    Метод запускается как отдельная asyncio задача при старте FastAPI приложения.
    Периодически опрашивает базу данных на предмет сущностей, которые 
    находятся в определенном состоянии (стадии) дольше положенного времени.
    """
    logger.info("⏱ BPM Worker loop started - Monitoring inactivity...")
    while True:
        try:
            # Используем фабричную сессию для фоновой задачи
            async with AsyncSessionLocal() as session:
                await check_time_triggers(session)
        except Exception as e:
            logger.exception(f"CRITICAL: BPM Worker error: {e}")
        
        # Интервал проверки. Оптимально 60 секунд для большинства BPM задач.
        # Если нагрузка возрастет, можно увеличить или вынести воркер в отдельный контейнер.
        await asyncio.sleep(60)

async def check_time_triggers(session: AsyncSession):
    """
    Ищет активные воркфлоу с триггером TIME_DELAY (контроль бездействия).
    
    Алгоритм:
    1. Найти все активные правила BPM с временной задержкой.
    2. Для каждого правила вычислить 'порог забвения' (текущее время минус delay_hours).
    3. Найти записи (Lead/Deal/Project), которые не обновлялись дольше этого порога.
    4. Инициировать выполнение воркфлоу через центральный BPMService.
    """
    # Выбираем только те воркфлоу, у которых есть триггер на время
    query = (
        select(BPMWorkflow)
        .join(BPMTrigger)
        .where(
            BPMWorkflow.is_active == True,
            BPMTrigger.type == TriggerType.TIME_DELAY
        )
    )
    result = await session.execute(query)
    # unique() нужен здесь из-за join, чтобы не было дублей воркфлоу
    workflows = result.scalars().unique().all()

    for workflow in workflows:
        # Извлекаем параметры триггера (количество часов задержки)
        trigger = next(t for t in workflow.triggers if t.type == TriggerType.TIME_DELAY)
        delay_hours = trigger.params.get("delay_hours", 24)
        
        # Точка во времени, до которой сущность должна была обновиться
        target_time = datetime.now(timezone.utc) - timedelta(hours=int(delay_hours))
        
        # Сопоставляем строковый тип сущности с моделью SQLAlchemy
        model: type | None = None
        if workflow.entity_type == "lead": model = Lead
        elif workflow.entity_type == "deal": model = Deal
        elif workflow.entity_type == "project": model = Project
        
        if model:
            # Ищем сущности, чье время последнего обновления меньше (раньше) целевого
            entities_query = select(model.id).where(model.updated_at < target_time)
            
            # Дополнительный фильтр по стадии (например, 'висит на стадии КП дольше 24ч')
            target_stage = trigger.params.get("target_stage_id")
            if target_stage:
                entities_query = entities_query.where(model.stage_id == int(target_stage))
            
            ent_result = await session.execute(entities_query)
            entity_ids = ent_result.scalars().all()
            
            for eid in entity_ids:
                # Передаем управление сервису выполнения. 
                # Он проверит условия и выполнит действия (например, сменит ответственного).
                logger.info(f"BPM Worker Task: Triggering '{workflow.name}' for {workflow.entity_type} ID:{eid}")
                await BPMService.trigger_event(
                    session, 
                    workflow.entity_type, 
                    eid, 
                    TriggerType.TIME_DELAY,
                    {"reason": "inactivity_limit_reached", "delay": delay_hours}
                )
    
    # Фиксируем все изменения (BPMService может менять поля сущностей)
    await session.commit()
