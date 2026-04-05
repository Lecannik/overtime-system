from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User, UserRole
from app.schemas.overtime import OvertimeCreate, OvertimeReview, OvertimeUpdate
from app.repositories import overtime as overtime_repo
from app.models.audit import AuditLog
from app.repositories import audit as audit_repo
from app.services import notifications
from app.repositories import organization as org_repo
from app.repositories import user as user_repo


from datetime import datetime
from app.core.utils import calculate_overtime_hours

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
    
    # 0. Валидация порядка времени (защита от "отрицательных" часов)
    if end_time <= start_time:
        raise HTTPException(
            status_code=400,
            detail="Время окончания должно быть позже времени начала."
        )

    # Убираем таймзоны для корректного сравнения
    if start_time.tzinfo:
        start_time = start_time.replace(tzinfo=None)
    if end_time.tzinfo:
        end_time = end_time.replace(tzinfo=None)

    # 1. Запрет на будущее время
    if start_time > datetime.now():
        raise HTTPException(
            status_code=400, 
            detail="Нельзя создавать заявку на будущее время."
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
    overtime_db = Overtime(
        **data,
        user_id=user_id,
        status=OvertimeStatus.PENDING
    )
    overtime = await overtime_repo.create_overtime(session, overtime_db)

    # Релоадим с релейшнами
    overtime = await overtime_repo.get_overtime_by_id(session, overtime.id)

    # 4. Проверка недельных лимитов
    weekly_hours = await overtime_repo.get_weekly_overtime_hours(
        session, user_id, overtime.project_id
    )
    
    # Получаем менеджера проекта
    manager = await user_repo.get_user_by_id(session, overtime.project.manager_id)
    
    # Если лимит превышен — уведомляем менеджера
    if weekly_hours > overtime.project.weekly_limit:
        await notifications.notify_limit_exceeded(
            session, overtime, manager, weekly_hours, overtime.project.weekly_limit
        )

    # Получаем начальника для стандартного уведомления
    dept = await org_repo.get_department_by_id(session, overtime.user.department_id)
    head = await user_repo.get_user_by_id(session, dept.head_id) if dept and dept.head_id else None

    await notifications.notify_new_overtime(session, overtime, manager, head)

    return overtime


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
            # Проверяем, что это начальник отдела ЭТОГО проекта
            if (
                current_user.role != UserRole.admin
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
        action=f"REVIEW_{current_user.role.upper()}",
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
    if current_user.role != UserRole.admin and overtime.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете редактировать только свои заявки")

    # Редактировать можно только PENDING (чтобы не менять уже согласованное или отмененное)
    if current_user.role != UserRole.admin and overtime.status != OvertimeStatus.PENDING:
        raise HTTPException(status_code=400, detail="Нельзя редактировать заявку, которая уже прошла согласование или отменена")

    update_data = overtime_in.model_dump(exclude_unset=True)
    
    # 0. Валидация времени (новая или старая - проверка на корректность)
    new_start = update_data.get("start_time", overtime.start_time)
    new_end = update_data.get("end_time", overtime.end_time)
    
    if new_start.tzinfo: new_start = new_start.replace(tzinfo=None)
    if new_end.tzinfo: new_end = new_end.replace(tzinfo=None)

    if new_end <= new_start:
        raise HTTPException(
            status_code=400,
            detail="Время окончания должно быть позже времени начала."
        )

    # 1. Проверка на пересечение (Overlap) при изменении времени
    if "start_time" in update_data or "end_time" in update_data:
        has_overlap = await overtime_repo.check_overlapping_overtimes(
            session, overtime.user_id, new_start, new_end, exclude_id=overtime.id
        )
        if has_overlap:
            raise HTTPException(
                status_code=400,
                detail="У вас уже есть другая заявка, пересекающаяся с этим периодом."
            )

    # Убираем таймзоны для итогового словаря
    if "start_time" in update_data: update_data["start_time"] = new_start
    if "end_time" in update_data: update_data["end_time"] = new_end

    # При изменении сбрасываем согласование и статус (если не админ меняет технически)
    if current_user.role != UserRole.admin:
        update_data["manager_approved"] = None
        update_data["head_approved"] = None
        update_data["status"] = OvertimeStatus.PENDING

    return await overtime_repo.update_overtime(session, overtime, update_data)
