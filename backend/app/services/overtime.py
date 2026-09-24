import logging
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from fastapi import HTTPException
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User, UserRole
from app.models.organization import Department
from app.schemas.overtime import OvertimeCreate, OvertimeReview, OvertimeUpdate
from app.repositories import overtime as overtime_repo
from app.models.audit import AuditLog
from app.repositories import audit as audit_repo
from app.services import notifications
from app.services.websocket import ws_manager
from app.repositories import organization as org_repo
from app.repositories import user as user_repo

from datetime import datetime, timedelta, timezone
from app.core.utils import calculate_overtime_hours, ensure_utc
from app.core.config import settings
from app.core.cache import cache_clear

logger = logging.getLogger(__name__)

async def create_new_overtime(session: AsyncSession, overtime_in: OvertimeCreate, user_id: int):
    """
    Создает новую заявку на переработку.
    
    Бизнес-логика:
    1. Валидация времени (нельзя в будущее).
    2. Проверка на пересечение с уже существующими заявками сотрудника.
    3. Создание записи в БД.
    4. Проверка недельного лимита проекта (уведомление менеджера при превышении).
    5. Отправка уведомлений руководителям (Менеджер + Нач. отдела).
    
    Args:
        session: Сессия БД.
        overtime_in: Данные из запроса (проект, время, описание, место).
        user_id: Владелец заявки.
    """
    start_time = overtime_in.start_time
    end_time = overtime_in.end_time
    
    # 0. Валидация существования и активности проекта (защита от краша 500 / AttributeError, Attack 1)
    project = await org_repo.get_project_by_id(session, overtime_in.project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=f"Проект с ID {overtime_in.project_id} не найден."
        )
    if not project.is_active:
        raise HTTPException(
            status_code=400,
            detail="Нельзя создать заявку по неактивному проекту."
        )

    # 0.1 Валидация обязательного заполнения времени окончания при ручном создании
    if not end_time:
        raise HTTPException(
            status_code=400,
            detail="Время окончания переработки обязательно для заполнения при ручном вводе."
        )
        
    # 0.2 Валидация порядка времени (защита от "отрицательных" часов)
    if end_time <= start_time:
        raise HTTPException(
            status_code=400,
            detail="Время окончания должно быть позже времени начала."
        )

    # 0.3 Валидация минимальной длительности (защита от Attack 6)
    duration_sec = (end_time - start_time).total_seconds()
    if duration_sec < 900:
        raise HTTPException(
            status_code=422,
            detail="Минимальная длительность переработки составляет 15 минут."
        )

    # Приводим к UTC-aware для корректной работы с timestamptz колонками
    start_time = ensure_utc(start_time)
    end_time = ensure_utc(end_time)

    # Защита от аномально большой длительности
    if end_time and start_time:
        total_hours = (end_time - start_time).total_seconds() / 3600
        if total_hours > settings.MAX_OVERTIME_HOURS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Длительность переработки ({total_hours:.1f}ч) превышает допустимый максимум "
                    f"({settings.MAX_OVERTIME_HOURS}ч). Проверьте правильность введённых данных."
                )
            )

    # 1. Запрет на будущее время (добавляем 5 минут буфера на случай рассинхрона часов)
    now_utc = datetime.now(timezone.utc) + timedelta(minutes=5)
    if start_time > now_utc:
        raise HTTPException(
            status_code=400, 
            detail="Время начала переработки не может быть в будущем."
        )
    if end_time and end_time > now_utc:
        raise HTTPException(
            status_code=400,
            detail="Время окончания переработки не может быть в будущем."
        )

    # 2. Проверка на пересечение (Overlap)
    has_overlap = await overtime_repo.check_overlapping_overtimes(
        session, user_id, start_time, end_time
    )
    if has_overlap:
        raise HTTPException(
            status_code=400,
            detail="У вас уже есть заявка, которая пересекается с этим интервалом времени."
        )

    # 3. Базовое создание
    data = overtime_in.model_dump()
    
    from app.core.utils import split_interval_by_days
    intervals = []
    if start_time and end_time:
        intervals = split_interval_by_days(start_time, end_time)
        
    if not intervals:
        intervals = [(start_time, end_time)]
        
    created_overtimes = []
    for s, e in intervals:
        item_data = data.copy()
        item_data["start_time"] = s
        item_data["end_time"] = e
        overtime_db = Overtime(
            **item_data,
            user_id=user_id,
            status=OvertimeStatus.PENDING
        )
        ot = await overtime_repo.create_overtime(session, overtime_db)
        
        # Получаем полный объект с релейшнами
        ot_full = await overtime_repo.get_overtime_by_id(session, ot.id)
        created_overtimes.append(ot_full)
        
        # 4. Проверка недельных лимитов для каждой части
        weekly_hours = await overtime_repo.get_weekly_overtime_hours(
            session, user_id, ot_full.project_id, target_date=ot_full.start_time
        )
        
        # Получаем менеджера проекта
        manager = None
        if ot_full.project.manager_id:
            manager = await user_repo.get_user_by_id(session, ot_full.project.manager_id)
        
        # Если лимит превышен — уведомляем менеджера
        if manager and weekly_hours > ot_full.project.weekly_limit:
            await notifications.notify_limit_exceeded(
                session, ot_full, manager, weekly_hours, ot_full.project.weekly_limit
            )
    
        # Получаем начальника для стандартного уведомления
        dept = await org_repo.get_department_by_id(session, ot_full.user.department_id)
        head = await user_repo.get_user_by_id(session, dept.head_id) if dept and dept.head_id else None
    
        await notifications.notify_new_overtime(session, ot_full, manager, head)

    cache_clear()
    try:
        await ws_manager.broadcast_to_all({
            "type": "OVERTIME_CREATED",
            "overtime_id": created_overtimes[0].id,
            "employee_name": created_overtimes[0].user.full_name if created_overtimes[0].user else ""
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error in create_new_overtime: {e}")

    return created_overtimes[0]


async def review_overtime(
    session: AsyncSession,
    overtime_id: int,
    review: OvertimeReview,
    current_user: User
):
    """
    Обрабатывает решение руководителя (или администратора) по заявке.
    
    Логика:
    1. Проверка прав доступа: роль (Manager/Head) должна соответствовать проекту/отделу заявки.
    2. Сохранение решения (Одобрено/Отклонено) и комментария.
    3. Обновление общего статуса заявки (Workflow).
    4. Логирование действия в AuditLog.
    5. Уведомление сотрудника о решении.
    
    Workflow статусов (Бизнес-логика согласования):
    - Любой Reject (отклонение) -> REJECTED
    - Если одобряет Менеджер -> MANAGER_APPROVED (заявка ожидает одобрения Начальника)
    - Если одобряет Начальник отдела (Head):
        * Если недельный лимит часов по проекту не превышен (`weekly_hours <= project.weekly_limit`),
          то статус становится APPROVED финально (без участия менеджера). Это намеренная
          бизнес-логика для упрощения согласования рядовых заявок.
        * Если лимит превышен, требуется также одобрение Менеджера. Если Менеджер уже одобрил,
          статус становится APPROVED, иначе переходит в HEAD_APPROVED.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if overtime.status == OvertimeStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Нельзя согласовать заявку, которая еще находится в процессе выполнения."
        )

    # Защита машины состояний: запрет повторного согласования терминальных статусов
    if overtime.status in (OvertimeStatus.APPROVED, OvertimeStatus.REJECTED, OvertimeStatus.CANCELLED):
        raise HTTPException(
            status_code=400,
            detail="Заявка находится в финальном статусе и не может быть изменена."
        )

    # Защита от конфликта интересов: Самосогласование (Self-Approval)
    is_self_approval = (overtime.user_id == current_user.id)
    if is_self_approval and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Конфликт интересов: запрещено согласовывать собственную заявку."
        )

    # 1. Режим Супер-админа: если админ не указал роль, одобряем за обоих сразу

    if current_user.role == UserRole.admin and not review.as_role:
        overtime.manager_approved = review.approved
        overtime.manager_comment = review.comment
        overtime.head_approved = review.approved
        overtime.head_comment = review.comment
    else:
        # 2. Обычный режим: определяем роль (с учетом as_role для админа)
        acting_role = (
            review.as_role
            if (current_user.role == UserRole.admin and review.as_role)
            else current_user.role
        )

        if acting_role == UserRole.manager:
            # Проверяем, что это менеджер ЭТОГО проекта
            if current_user.role != UserRole.admin and overtime.project.manager_id != current_user.id:
                raise HTTPException(
                    status_code=403,
                    detail="Вы не являетесь менеджером этого проекта"
                )
            overtime.manager_approved = review.approved
            overtime.manager_comment = review.comment
        elif acting_role == UserRole.head:
            # Проверяем, является ли пользователь начальником отдела сотрудника
            is_their_head = False
            if overtime.user.department_id:
                dept_res = await session.execute(
                    select(Department).where(Department.id == overtime.user.department_id)
                )
                dept = dept_res.scalar_one_or_none()
                if dept and dept.head_id == current_user.id:
                    is_their_head = True

            # Проверяем, является ли пользователь менеджером этого проекта
            is_project_manager = (
                overtime.project.manager_id is not None
                and overtime.project.manager_id == current_user.id
            )

            if (
                current_user.role != UserRole.admin
                and not is_their_head
                and not is_project_manager
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Вы не являетесь ни начальником отдела этого сотрудника, ни менеджером проекта"
                )

            if is_their_head and is_project_manager:
                # Начальник отдела сам же ведет этот проект: утверждаем обе роли
                overtime.head_approved = review.approved
                overtime.head_comment = review.comment
                overtime.manager_approved = review.approved
                overtime.manager_comment = review.comment
            elif is_their_head or current_user.role == UserRole.admin:
                # Согласование со стороны начальника отдела
                overtime.head_approved = review.approved
                overtime.head_comment = review.comment
            else:
                # Согласование со стороны менеджера проекта (для сотрудника из другого отдела)
                overtime.manager_approved = review.approved
                overtime.manager_comment = review.comment
        else:
            raise HTTPException(status_code=403, detail="У вас нет прав для этого действия")


    # Сохраняем переданные часы (если они есть в решении)
    if review.approved_hours is not None:
        overtime.approved_hours = review.approved_hours

    # 3. Финальный пересчет статуса
    if overtime.manager_approved is False or overtime.head_approved is False:
        overtime.status = OvertimeStatus.REJECTED

    elif overtime.head_approved is True:
        # Проверяем лимит для принятия решения о финальном одобрении
        weekly_hours = await overtime_repo.get_weekly_overtime_hours(
            session, overtime.user_id, overtime.project_id, target_date=overtime.start_time
        )
        
        # Если лимит не превышен, одобрения Начальника (Head) достаточно
        if weekly_hours <= overtime.project.weekly_limit:
            overtime.status = OvertimeStatus.APPROVED
        else:
            # Если лимит превышен — ждем еще и менеджера
            if overtime.manager_approved is True:
                overtime.status = OvertimeStatus.APPROVED
            else:
                overtime.status = OvertimeStatus.HEAD_APPROVED

    elif overtime.manager_approved is True:
        overtime.status = OvertimeStatus.MANAGER_APPROVED

    # Если заявка полностью одобрена, но часы не были изменены вручную — 
    # устанавливаем их равными запрошенным (с учетом округления бизнес-логики)
    if overtime.status == OvertimeStatus.APPROVED and overtime.approved_hours is None:
        overtime.approved_hours = overtime.hours

    # 4. Логируем действие
    action_name = "SELF_REVIEW_ADMIN" if is_self_approval else f"REVIEW_{current_user.role.upper()}"
    await audit_repo.create_audit_log(
        session=session,
        user_id=current_user.id,
        action=action_name,
        target_type="overtime",
        target_id=overtime.id,
        details={
            "approved": review.approved,
            "comment": review.comment,
            "new_status": overtime.status,
            "as_role": review.as_role,
            "is_self_approval": is_self_approval,
            "description": overtime.description,
            "requested_hours": overtime.hours,
            "raw_hours_exact": overtime.raw_hours,
            "approved_hours": overtime.approved_hours
        }
    )

    # 5. Сохраняем изменения
    await session.commit()
    await session.refresh(overtime)

    # 6. Уведомляем сотрудника и при самосогласовании коллег-администраторов
    if is_self_approval and current_user.role == UserRole.admin:
        await notifications.notify_admin_self_approval(session, overtime, current_user)

    await notifications.notify_overtime_review(session, overtime, current_user)

    try:
        await ws_manager.broadcast_to_all({
            "type": "OVERTIME_STATUS_CHANGED",
            "overtime_id": overtime.id,
            "new_status": overtime.status.value,
            "reviewer_name": current_user.full_name,
            "approved": review.approved,
            "employee_name": overtime.user.full_name if overtime.user else ""
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error in review_overtime: {e}")

    return overtime

async def cancel_overtime(
    session: AsyncSession,
    overtime_id: int,
    current_user: User
):
    """
    Отменяет заявку. 
    Доступно владельцу заявки (если она еще не обработана под корень) или администратору.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Проверка прав: только владелец или админ
    if current_user.role != UserRole.admin and overtime.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете отменять только свои заявки")

    # Нельзя отменить уже отменённую
    if overtime.status == OvertimeStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Заявка уже отменена")

    # Нельзя отменить уже утвержденную или отклоненную заявку рядовому сотруднику
    if current_user.role != UserRole.admin and overtime.status in (OvertimeStatus.APPROVED, OvertimeStatus.REJECTED):
        status_word = "утвержденную" if overtime.status == OvertimeStatus.APPROVED else "отклоненную"
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя отменить уже {status_word} заявку. Для изменения статуса обратитесь к администратору."
        )

    # Сохраняем предыдущий статус ДО изменения (для корректного аудит-лога)
    previous_status = overtime.status

    # Меняем статус
    overtime.status = OvertimeStatus.CANCELLED

    # Логируем действие
    await audit_repo.create_audit_log(
        session=session,
        user_id=current_user.id,
        action="CANCEL_OVERTIME",
        target_type="overtime",
        target_id=overtime.id,
        details={
            "cancelled_by": current_user.email,
            "previous_status": previous_status,
            "is_own": overtime.user_id == current_user.id,
            "description": overtime.description
        }
    )


    await session.commit()
    await session.refresh(overtime)
    cache_clear()

    try:
        await ws_manager.broadcast_to_all({
            "type": "OVERTIME_STATUS_CHANGED",
            "overtime_id": overtime.id,
            "new_status": overtime.status.value,
            "reviewer_name": current_user.full_name,
            "action": "cancel",
            "employee_name": overtime.user.full_name if overtime.user else ""
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error in cancel_overtime: {e}")

    return overtime


async def restore_overtime(
    session: AsyncSession,
    overtime_id: int,
    current_user: User
):
    """
    Восстанавливает отменённую заявку в статус PENDING.

    Бизнес-логика:
    - Доступно только владельцу заявки или администратору.
    - Работает только для заявок в статусе CANCELLED.
    - Сбрасывает все результаты согласования (manager_approved, head_approved) в None.
    - Очищает approved_hours.
    - Возвращает статус в PENDING для повторного прохождения согласования.
    - Логирует действие в AuditLog.

    Args:
        session: Сессия БД.
        overtime_id: ID восстанавливаемой заявки.
        current_user: Инициатор операции.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Проверка прав: только владелец или админ
    if current_user.role != UserRole.admin and overtime.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете восстанавливать только свои заявки")

    # Восстанавливать можно только отменённые
    if overtime.status != OvertimeStatus.CANCELLED:
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя восстановить заявку со статусом '{overtime.status.russian_label}'. Доступно только для отменённых заявок."
        )

    # Запрет сброса виз, если заявка уже была ранее согласована или отклонена руководством
    if current_user.role != UserRole.admin and (
        overtime.head_approved is not None or overtime.manager_approved is not None
    ):
        raise HTTPException(
            status_code=400,
            detail="Нельзя восстановить заявку, решение по которой уже было принято руководством. Для изменения статуса обратитесь к администратору."
        )

    # Сбрасываем все результаты согласования — заявка должна пройти проверку заново
    overtime.status = OvertimeStatus.PENDING
    overtime.manager_approved = None
    overtime.head_approved = None
    overtime.manager_comment = None
    overtime.head_comment = None
    overtime.approved_hours = None

    # Логируем действие
    await audit_repo.create_audit_log(
        session=session,
        user_id=current_user.id,
        action="RESTORE_OVERTIME",
        target_type="overtime",
        target_id=overtime.id,
        details={
            "restored_by": current_user.email,
            "is_own": overtime.user_id == current_user.id,
            "description": overtime.description,
            "new_status": OvertimeStatus.PENDING,
        }
    )

    await session.commit()
    await session.refresh(overtime)
    cache_clear()

    # WebSocket broadcast об изменении статуса заявки
    await ws_manager.broadcast_to_all({
        "type": "OVERTIME_STATUS_CHANGED",
        "overtime_id": overtime.id,
        "new_status": overtime.status.value,
        "reviewer_name": current_user.full_name,
        "action": "restore",
        "employee_name": overtime.user.full_name if overtime.user else "",
    })

    return overtime



async def update_overtime(
    session: AsyncSession,
    overtime_id: int,
    overtime_in: OvertimeUpdate,
    current_user: User
):
    """
    Обновляет данные заявки.
    При любом изменении данных сотрудником (проект, время), результаты 
    предыдущих согласований сбрасываются в ожидание (None), а статус возвращается в PENDING.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Сохраняем исходные значения времени для сравнения в аудит-логе
    old_start = overtime.start_time
    old_end = overtime.end_time
    old_hours = overtime.hours

    # Только владелец или админ
    if current_user.role != UserRole.admin and overtime.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете редактировать только свои заявки")

    # Редактировать можно только PENDING или IN_PROGRESS (чтобы не менять уже согласованное или отмененное)
    if current_user.role != UserRole.admin and overtime.status not in (OvertimeStatus.PENDING, OvertimeStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail="Нельзя редактировать заявку, которая уже прошла согласование или отменена")

    update_data = overtime_in.model_dump(exclude_unset=True)
    
    # 0. Валидация времени (новая или старая - проверка на корректность)
    new_start = update_data.get("start_time", overtime.start_time)
    new_end = update_data.get("end_time", overtime.end_time)
    
    new_start = ensure_utc(new_start)
    new_end = ensure_utc(new_end)

    if new_end and new_start and new_end <= new_start:
        raise HTTPException(
            status_code=400,
            detail="Время окончания должно быть позже времени начала."
        )

    if new_end and new_start:
        total_hours = (new_end - new_start).total_seconds() / 3600
        if total_hours > settings.MAX_OVERTIME_HOURS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Длительность переработки ({total_hours:.1f}ч) превышает допустимый максимум "
                    f"({settings.MAX_OVERTIME_HOURS}ч). Проверьте правильность введённых данных."
                )
            )
        # Валидация минимальной длительности (Attack 3)
        duration_sec = (new_end - new_start).total_seconds()
        if duration_sec < 900:
            raise HTTPException(
                status_code=422,
                detail="Минимальная длительность переработки составляет 15 минут."
            )

    # 1. Запрет на будущее время при обновлении (добавляем 5 минут буфера)
    now_utc = datetime.now(timezone.utc) + timedelta(minutes=5)
    if "start_time" in update_data and new_start > now_utc:
        raise HTTPException(
            status_code=400,
            detail="Время начала переработки не может быть в будущем."
        )
    if "end_time" in update_data and new_end and new_end > now_utc:
        raise HTTPException(
            status_code=400,
            detail="Время окончания переработки не может быть в будущем."
        )

    # 2. Проверка на пересечение (Overlap) при изменении времени
    if "start_time" in update_data or "end_time" in update_data:
        has_overlap = await overtime_repo.check_overlapping_overtimes(
            session, overtime.user_id, new_start, new_end, exclude_id=overtime.id
        )
        if has_overlap:
            raise HTTPException(
                status_code=400,
                detail="У вас уже есть другая заявка, пересекающаяся с этим периодом."
            )

    # Валидация целевого проекта при смене (Attack 4)
    if "project_id" in update_data and update_data["project_id"] is not None:
        target_project = await org_repo.get_project_by_id(session, update_data["project_id"])
        if not target_project:
            raise HTTPException(
                status_code=404,
                detail=f"Проект с ID {update_data['project_id']} не найден."
            )
        if not target_project.is_active:
            raise HTTPException(
                status_code=400,
                detail="Нельзя привязать заявку к неактивному проекту."
            )

    # Выявляем факт изменения полей
    time_changed = False
    if "start_time" in update_data and ensure_utc(update_data["start_time"]) != ensure_utc(old_start):
        time_changed = True
    if "end_time" in update_data and ensure_utc(update_data["end_time"]) != ensure_utc(old_end):
        time_changed = True

    desc_changed = "description" in update_data and update_data["description"] != overtime.description
    project_changed = "project_id" in update_data and update_data["project_id"] != overtime.project_id

    # Убираем таймзоны для итогового словаря
    if "start_time" in update_data: update_data["start_time"] = new_start
    if "end_time" in update_data: update_data["end_time"] = new_end

    # При изменении сбрасываем согласование и статус (если не админ меняет технически)
    if current_user.role != UserRole.admin:
        update_data["manager_approved"] = None
        update_data["head_approved"] = None
        if overtime.status == OvertimeStatus.IN_PROGRESS:
            update_data["status"] = OvertimeStatus.IN_PROGRESS
        else:
            update_data["status"] = OvertimeStatus.PENDING

    # Сохраняем значения для лога
    old_desc = overtime.description
    old_proj = overtime.project_id

    result = await overtime_repo.update_overtime(session, overtime, update_data)

    # Запись аудит-лога
    if time_changed:
        from app.repositories import audit as audit_repo
        await audit_repo.create_audit_log(
            session=session,
            user_id=current_user.id,
            action="UPDATE_OVERTIME_TIME",
            target_type="overtime",
            target_id=overtime.id,
            details={
                "updated_by": current_user.email,
                "role": current_user.role,
                "is_own": overtime.user_id == current_user.id,
                "description": overtime.description,
                "employee_id": overtime.user_id,
                "old_start": ensure_utc(old_start).isoformat() if old_start else None,
                "new_start": ensure_utc(result.start_time).isoformat() if result.start_time else None,
                "old_end": ensure_utc(old_end).isoformat() if old_end else None,
                "new_end": ensure_utc(result.end_time).isoformat() if result.end_time else None,
                "old_hours": old_hours,
                "new_hours": result.hours,
            }
        )

    if current_user.role == UserRole.admin and (desc_changed or project_changed):
        from app.repositories import audit as audit_repo
        await audit_repo.create_audit_log(
            session=session,
            user_id=current_user.id,
            action="ADMIN_UPDATE_OVERTIME",
            target_type="overtime",
            target_id=overtime.id,
            details={
                "updated_by": current_user.email,
                "employee_id": overtime.user_id,
                "overtime_status": str(overtime.status.value),
                "changes": {
                    "description": {"old": old_desc, "new": result.description} if desc_changed else None,
                    "project_id": {"old": old_proj, "new": result.project_id} if project_changed else None,
                }
            }
        )

    await session.commit()
    await session.refresh(result)
    cache_clear()

    # WebSocket broadcast об изменении параметров заявки
    await ws_manager.broadcast_to_all({
        "type": "OVERTIME_STATUS_CHANGED",
        "overtime_id": result.id,
        "new_status": result.status.value,
        "reviewer_name": current_user.full_name,
        "action": "update",
        "employee_name": result.user.full_name if result.user else "",
    })

    return result


async def auto_close_stale_sessions(session: AsyncSession) -> int:
    """
    Находит все IN_PROGRESS сессии старше MAX_OVERTIME_HOURS и автоматически закрывает их.
    Конечное время выставляется как start_time + MAX_OVERTIME_HOURS (не текущее время),
    чтобы не создавать раздутые записи при многодневных зависаниях.
    Интервал разбивается по 00:00, создаются записи PENDING.
    Возвращает количество закрытых сессий.
    """
    import logging
    logger = logging.getLogger("auto_close")

    from app.core.utils import split_interval_by_days
    from app.repositories.overtime import get_all_stale_in_progress

    stale = await get_all_stale_in_progress(session, settings.MAX_OVERTIME_HOURS)
    if not stale:
        return 0

    count = 0
    for active in stale:
        auto_end = active.start_time + timedelta(hours=settings.MAX_OVERTIME_HOURS)

        intervals = split_interval_by_days(active.start_time, auto_end)
        if not intervals:
            intervals = [(active.start_time, auto_end)]

        original_start = active.start_time

        active.start_time = intervals[0][0]
        active.end_time = intervals[0][1]
        active.status = OvertimeStatus.PENDING
        if not active.description or active.description.strip() in ("", "[Бот]"):
            active.description = "[Автозакрытие: сессия превысила лимит]"

        for s, e in intervals[1:]:
            new_ot = Overtime(
                user_id=active.user_id,
                project_id=active.project_id,
                start_time=s,
                end_time=e,
                description=active.description,
                status=OvertimeStatus.PENDING,
            )
            session.add(new_ot)

        await audit_repo.create_audit_log(
            session=session,
            user_id=active.user_id,
            action="AUTO_CLOSE_STALE",
            target_type="overtime",
            target_id=active.id,
            details={
                "reason": f"IN_PROGRESS exceeded {settings.MAX_OVERTIME_HOURS}h limit",
                "original_start": original_start.isoformat(),
                "auto_end": auto_end.isoformat(),
                "intervals": len(intervals),
            },
        )
        logger.warning(
            "Auto-closed stale session id=%d user_id=%d started=%s",
            active.id, active.user_id, original_start.isoformat()
        )
        # Уведомляем пользователя через Telegram
        if active.user and active.user.telegram_chat_id:
            try:
                from app.services.bot_service import _notify_auto_close
                await _notify_auto_close(
                    chat_id=active.user.telegram_chat_id,
                    overtime_id=active.id,
                    original_start=original_start,
                    auto_end=auto_end,
                    intervals_count=len(intervals),
                )
            except Exception:
                logger.exception("Failed to notify user %d about auto-close", active.user_id)
        count += 1

    if count:
        await session.commit()

    return count
