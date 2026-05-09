from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User
from app.schemas.overtime import OvertimeCreate, OvertimeReview, OvertimeUpdate
from app.repositories import overtime as overtime_repo
from app.models.audit import AuditLog
from app.repositories import audit as audit_repo
from app.services import notifications
from app.repositories import organization as org_repo
from app.repositories import user as user_repo
from app.services.analytics_service import AnalyticsService


from datetime import datetime, time, timedelta, timezone
from app.core.utils import calculate_overtime_hours

async def create_new_overtime(session: AsyncSession, overtime_in: OvertimeCreate, user_id: int):
    """
    Создает заявку на переработку.
    Если интервал пересекает полночь (в локальном времени пользователя), 
    автоматически разделяет её на несколько записей.
    """
    original_start = overtime_in.start_time
    original_end = overtime_in.end_time
    offset_min = overtime_in.timezone_offset or 0  # JS getTimezoneOffset(): для +05:00 = -300

    if original_end <= original_start:
        raise HTTPException(status_code=400, detail="Время окончания должно быть позже времени начала.")

    # 1. Гарантируем, что datetime имеет UTC-метку (aware)
    def ensure_utc_aware(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    start_utc = ensure_utc_aware(original_start)
    end_utc = ensure_utc_aware(original_end)

    # 2. Часовой пояс клиента: JS getTimezoneOffset() возвращает разницу UTC - LOCAL в минутах
    #    Для +05:00 (Ёкатеринбург): getTimezoneOffset() = -300
    #    Формула: local = utc - offset_min (в минутах)
    #    timezone() принимает смещение UTC→LOCAL: для +05:00 = +300 мин, т.е. -offset_min
    client_tz = timezone(timedelta(minutes=-offset_min))

    # 3. Конвертим UTC → локальное время для определения границ суток
    curr_s_local = start_utc.astimezone(client_tz)
    end_local = end_utc.astimezone(client_tz)

    # 4. Разделяем интервал по полуночи в ЛОКАЛЬНОМ времени клиента
    intervals_utc = []

    while curr_s_local.date() < end_local.date():
        # Полночь следующего локального дня (сохраняем tzinfo!)
        midnight_local = (curr_s_local + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=client_tz
        )
        # Конвертируем обратно в naive UTC для PostgreSQL
        chunk_s_utc = curr_s_local.astimezone(timezone.utc).replace(tzinfo=None)
        chunk_e_utc = midnight_local.astimezone(timezone.utc).replace(tzinfo=None)

        intervals_utc.append((chunk_s_utc, chunk_e_utc))
        curr_s_local = midnight_local

    # Последний (или единственный) кусок
    intervals_utc.append((
        curr_s_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_utc.astimezone(timezone.utc).replace(tzinfo=None)
    ))

    created_overtimes = []
    
    for s_utc, e_utc in intervals_utc:
        # Проверка на пересечение (уже в UTC)
        has_overlap = await overtime_repo.check_overlapping_overtimes(
            session, user_id, s_utc, e_utc
        )
        if has_overlap:
            raise HTTPException(
                status_code=400, 
                detail=f"Конфликт: период {s_utc.strftime('%H:%M')} - {e_utc.strftime('%H:%M')} (UTC) пересекается с существующей заявкой."
            )

        # Создание записи
        data = overtime_in.model_dump(exclude={"timezone_offset"})
        data["start_time"] = s_utc
        data["end_time"] = e_utc
        
        overtime_db = Overtime(
            **data,
            user_id=user_id,
            status=OvertimeStatus.PENDING
        )
        new_ot = await overtime_repo.create_overtime(session, overtime_db)
        created_overtimes.append(new_ot)

    # Уведомления (только для первой части, чтобы не спамить, или для всей группы)
    # Для простоты берем первую созданную
    main_ot = await overtime_repo.get_overtime_by_id(session, created_overtimes[0].id)
    
    # Проверка лимитов и уведомления
    weekly_hours = await overtime_repo.get_weekly_overtime_hours(
        session, user_id, main_ot.project_id
    )
    
    manager = await user_repo.get_user_by_id(session, main_ot.project.manager_id)
    if weekly_hours > main_ot.project.weekly_limit:
        await notifications.notify_limit_exceeded(
            session, main_ot, manager, weekly_hours, main_ot.project.weekly_limit
        )

    dept = await org_repo.get_department_by_id(session, main_ot.user.department_id)
    head = await user_repo.get_user_by_id(session, dept.head_id) if dept and dept.head_id else None

    await notifications.notify_new_overtime(session, main_ot, manager, head)

    return main_ot


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
    
    Workflow статусов:
    - Оба Ок -> APPROVED
    - Любой Reject -> REJECTED
    - Только один Ок -> MANAGER_APPROVED / HEAD_APPROVED
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # 1. Режим Супер-админа: если админ не указал роль, одобряем за обоих сразу
    if current_user.role_name.lower() == "admin" and not review.as_role:
        overtime.manager_approved = review.approved
        overtime.manager_comment = review.comment
        overtime.head_approved = review.approved
        overtime.head_comment = review.comment
    else:
        # 2. Обычный режим: определяем роль (с учетом as_role для админа)
        acting_role = (
            review.as_role
            if (current_user.role_name.lower() == "admin" and review.as_role)
            else current_user.role_name.lower()
        )

        if acting_role == "manager":
            # Проверяем, что это менеджер ЭТОГО проекта
            if current_user.role_name.lower() != "admin" and overtime.project.manager_id != current_user.id:
                raise HTTPException(
                    status_code=403,
                    detail="Вы не являетесь менеджером этого проекта"
                )
            overtime.manager_approved = review.approved
            overtime.manager_comment = review.comment
        elif acting_role == "head":
            # Проверяем, что это начальник отдела ЭТОГО проекта
            if (
                current_user.role_name.lower() != "admin"
                and overtime.user.department_id != current_user.department_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Вы не являетесь начальником отдела этого сотрудника"
                )
            overtime.head_approved = review.approved
            overtime.head_comment = review.comment
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
            session, overtime.user_id, overtime.project_id
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
    await audit_repo.create_audit_log(
        session=session,
        user_id=current_user.id,
        action=f"REVIEW_{current_user.role_name.upper()}",
        target_type="overtime",
        target_id=overtime.id,
        details={
            "approved": review.approved,
            "comment": review.comment,
            "new_status": overtime.status,
            "as_role": review.as_role,
            "description": overtime.description,
            "requested_hours": overtime.hours,
            "raw_hours_exact": overtime.raw_hours,
            "approved_hours": overtime.approved_hours
        }
    )

    # 5. Сохраняем изменения
    await session.commit()
    await session.refresh(overtime)

    # 6. Уведомляем сотрудника
    await notifications.notify_overtime_review(session, overtime, current_user)

    # 7. ЕСЛИ ЗАЯВКА ОДОБРЕНА - ТРИГГЕРИМ ПЕРЕСЧЕТ АНАЛИТИКИ ПРОЕКТА
    if overtime.status == OvertimeStatus.APPROVED:
        await AnalyticsService.update_project_finances(session, overtime.project_id)

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
    if current_user.role_name.lower() != "admin" and overtime.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете отменять только свои заявки")

    # Нельзя отменить уже отменённую
    if overtime.status == OvertimeStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Заявка уже отменена")

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
            "previous_status": overtime.status,
            "is_own": overtime.user_id == current_user.id,
            "description": overtime.description
        }
    )

    await session.commit()
    await session.refresh(overtime)
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

    # Только владелец или админ
    if current_user.role_name.lower() != "admin" and overtime.status != OvertimeStatus.PENDING:
        raise HTTPException(status_code=400, detail="Нельзя редактировать заявку, которая уже прошла согласование или отменена")

    update_data = overtime_in.model_dump(exclude_unset=True, exclude={"timezone_offset"})
    
    # ПРИВОДИМ К UTC ДЛЯ БД
    new_start = update_data.get("start_time", overtime.start_time)
    new_end = update_data.get("end_time", overtime.end_time)

    if isinstance(new_start, datetime) and new_start.tzinfo:
        new_start = new_start.astimezone(timezone.utc).replace(tzinfo=None)
    if isinstance(new_end, datetime) and new_end.tzinfo:
        new_end = new_end.astimezone(timezone.utc).replace(tzinfo=None)

    if new_end <= new_start:
        raise HTTPException(status_code=400, detail="Время окончания должно быть позже времени начала.")

    # Проверка на пересечение
    if "start_time" in update_data or "end_time" in update_data:
        has_overlap = await overtime_repo.check_overlapping_overtimes(
            session, overtime.user_id, new_start, new_end, exclude_id=overtime.id
        )
        if has_overlap:
            raise HTTPException(status_code=400, detail="У вас уже есть другая заявка, пересекающаяся с этим периодом.")

    # Принудительно ставим очищенные даты в update_data
    if "start_time" in update_data: update_data["start_time"] = new_start
    if "end_time" in update_data: update_data["end_time"] = new_end

    # При изменении сбрасываем согласование и статус
    if current_user.role_name.lower() != "admin":
        update_data["manager_approved"] = None
        update_data["head_approved"] = None
        update_data["status"] = OvertimeStatus.PENDING

    return await overtime_repo.update_overtime(session, overtime, update_data)
