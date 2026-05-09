import time
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bpm import BPMWorkflow, BPMTrigger, BPMAction, BPMLog, TriggerType, ActionType
from app.models.task import Task
from app.models.crm import Lead, Deal
from app.models.user import User
from app.services.telegram import send_telegram_message
import logging

logger = logging.getLogger(__name__)

class BPMService:
    """
    Центральный сервис управления бизнес-процессами (BPM Engine).
    
    Отвечает за:
    1. Перехват событий (trigger_event).
    2. Проверку условий (conditions).
    3. Выполнение цепочки действий (actions).
    4. Логирование результатов.
    """

    @staticmethod
    async def trigger_event(
        session: AsyncSession, 
        entity_type: str, 
        entity_id: int, 
        trigger_type: TriggerType,
        params: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Запускает проверку и выполнение всех активных воркфлоу для данного события.
        Примеры событий: создание лида, смена стадии сделки, задержка ответа.
        """
        start_time = time.time()
        params = params or {}
        
        # 1. Поиск воркфлоу, подписанных на этот тип триггера и сущности
        query = (
            select(BPMWorkflow)
            .join(BPMTrigger)
            .where(
                BPMWorkflow.entity_type == entity_type,
                BPMWorkflow.is_active == True,
                BPMTrigger.type == trigger_type
            )
            .options(
                selectinload(BPMWorkflow.triggers),
                selectinload(BPMWorkflow.actions)
            )
        )
        
        result = await session.execute(query)
        workflows = result.scalars().unique().all()
        
        if not workflows:
            return  # Нет правил для обработки этого события

        # 2. Извлекаем полную информацию о сущности (Lead/Deal/Project)
        entity = await BPMService._get_entity(session, entity_type, entity_id)
        if not entity:
            logger.warning(f"BPM: Entity {entity_type}:{entity_id} not found, skipping workflow")
            return

        for workflow in workflows:
            try:
                # 3. Фильтрация по специфичным параметрам триггера
                matches_trigger = False
                for trigger in workflow.triggers:
                    if trigger.type == trigger_type:
                        # Если триггер - смена стадии, проверяем, та ли это стадия
                        if trigger_type == TriggerType.STAGE_CHANGED:
                            target_stage = trigger.params.get("target_stage_id")
                            current_stage = params.get("new_stage_id")
                            if target_stage and int(target_stage) != int(current_stage):
                                continue
                        
                        # Проверка статических условий (например: сумма > 100000)
                        if not BPMService._check_conditions(entity, trigger.conditions):
                            continue
                            
                        matches_trigger = True
                        break
                
                if not matches_trigger:
                    continue

                # 4. Последовательное выполнение всех действий в правиле
                logger.info(f"BPM: Executing workflow '{workflow.name}' for {entity_type}:{entity_id}")
                for action in sorted(workflow.actions, key=lambda a: a.sort_order):
                    await BPMService._execute_action(session, action, entity, entity_type, params)
                
                # 5. Записываем результат выполнения
                duration_ms = int((time.time() - start_time) * 1000)
                await BPMService._log(session, workflow.id, entity_id, "success", 
                                     f"Successfully executed {len(workflow.actions)} actions.", duration_ms)
                
            except Exception as e:
                logger.error(f"BPM: Workflow {workflow.id} execution failed: {str(e)}")
                duration_ms = int((time.time() - start_time) * 1000)
                await BPMService._log(session, workflow.id, entity_id, "error", str(e), duration_ms)

    @staticmethod
    async def _get_entity(session: AsyncSession, entity_type: str, entity_id: int) -> Any:
        # Прямое получение объекта из БД по ID
        if entity_type == "lead": return await session.get(Lead, entity_id)
        elif entity_type == "deal": return await session.get(Deal, entity_id)
        elif entity_type == "project": return await session.get(Project, entity_id)
        return None

    @staticmethod
    def _check_conditions(entity: Any, conditions: Optional[Dict[str, Any]]) -> bool:
        """
        Проверяет, удовлетворяет ли сущность заданным критериям (JSON-условия).
        Пример: budget >= 500000
        """
        if not conditions:
            return True
        
        # Простая реализация: поле должно в точности совпадать со значением
        for key, expected_value in conditions.items():
            actual_value = getattr(entity, key, None)
            if actual_value != expected_value:
                return False
        return True

    @staticmethod
    async def _execute_action(session: AsyncSession, action: BPMAction, entity: Any, entity_type: str, params: Dict[str, Any]) -> None:
        """Реализация конкретных типов действий BPM."""
        
        if action.type == ActionType.CREATE_TASK:
            # Создание напоминания/задачи для сотрудника
            p = action.params
            assigned_id = None
            
            # 1. Пытаемся найти по конкретному ID пользователя
            if p.get("assigned_id"):
                assigned_id = int(p.get("assigned_id"))
            
            # 2. Пытаемся найти по должности (самое гибкое)
            elif p.get("assigned_position"):
                pos_val = p.get("assigned_position")
                # Ищем пользователя с такой должностью
                from app.models.organization import JobPosition
                stmt = select(User).join(JobPosition).where(User.is_active == True)
                if isinstance(pos_val, int) or pos_val.isdigit():
                    stmt = stmt.where(JobPosition.id == int(pos_val))
                else:
                    stmt = stmt.where(JobPosition.name.ilike(f"%{pos_val}%"))
                
                res = await session.execute(stmt)
                user = res.scalars().first()
                if user:
                    assigned_id = user.id
            
            # 3. Fallback на ответственного за сущность
            if not assigned_id:
                assigned_id = getattr(entity, "assigned_id", None) or getattr(entity, "manager_id", None)

            # Определяем тип задачи (если передан)
            type_id = p.get("type_id")
            
            new_task = Task(
                title=p.get("title", "🔔 Авто-задача"),
                description=p.get("description", "Создано автоматически системой BPM"),
                priority=p.get("priority", "MEDIUM"),
                status="TODO",
                assigned_id=assigned_id,
                type_id=type_id,
                creator_id=params.get("user_id") or 1 # Система или текущий юзер
            )
            
            # Привязка к контексту (лид/сделка/проект)
            if entity_type == "lead": new_task.lead_id = entity.id
            elif entity_type == "deal": new_task.deal_id = entity.id
            elif entity_type == "project": new_task.project_id = entity.id
            
            session.add(new_task)
            await session.flush()
            
        elif action.type == ActionType.SEND_NOTIFICATION:
            # Отправка уведомления в Telegram через TelegramService
            template = action.params.get("template", "Новое уведомление: {title}")
            recipient_type = action.params.get("recipient_type", "assigned")
            
            # Динамическая замена переменных в тексте уведомления
            msg = template
            for attr in ["title", "id", "name", "full_name"]:
                if hasattr(entity, attr):
                    msg = msg.replace(f"{{{attr}}}", str(getattr(entity, attr)))
            
            # Определяем, кому отправить
            target_uid = None
            if recipient_type == "user_id": 
                target_uid = int(action.params.get("user_id")) if action.params.get("user_id") else None
            elif recipient_type == "assigned": target_uid = getattr(entity, "assigned_id", None)
            elif recipient_type == "creator": target_uid = getattr(entity, "creator_id", None)
                
            if target_uid:
                user = await session.get(User, target_uid)
                if user and user.telegram_chat_id:
                    await send_telegram_message(session, user.telegram_chat_id, f"🚀 <b>BPM Automation</b>\n\n{msg}")
            
        elif action.type == ActionType.SET_FIELD:
            # Прямое изменение поля документа (например, закрытие при переносе в WON)
            fname, fval = action.params.get("field"), action.params.get("value")
            if fname and hasattr(entity, fname):
                if fname.endswith("_id") and fval is not None:
                    try: fval = int(fval)
                    except: pass
                setattr(entity, fname, fval)
                session.add(entity)

        elif action.type == ActionType.SET_RESPONSIBLE:
            # Эскалация: автоматическая смена менеджера на сделке/лиде
            new_uid = action.params.get("user_id")
            if new_uid:
                new_uid = int(new_uid)
                field = "manager_id" if entity_type == "project" else "assigned_id"
                if hasattr(entity, field):
                    setattr(entity, field, new_uid)
                    session.add(entity)

    @staticmethod
    async def _log(session: AsyncSession, workflow_id: int, entity_id: int, status: str, message: str, duration: int) -> None:
        """Сохранение истории выполнения для отображения в карточке сущности."""
        log = BPMLog(
            workflow_id=workflow_id,
            entity_id=entity_id,
            status=status,
            message=message[:255], # Ограничиваем длину сообщения
            execution_time=duration
        )
        session.add(log)
        # Flush используется чтобы данные были доступны в текущей сессии
        await session.flush()
