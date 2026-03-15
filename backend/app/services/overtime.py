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


async def create_new_overtime(session: AsyncSession, overtime_in: OvertimeCreate, user_id: int):
    """
    Создает новую заявку на переработку.

    Args:
        session: Асинхронная сессия SQLAlchemy.
        overtime_in: Данные заявки (дата, часы, проект_id).
        user_id: ID сотрудника, подающего заявку.

    Returns:
        Созданная заявка с загруженными отношениями.
    """
    data = overtime_in.model_dump()

    overtime_db = Overtime(
        **data,
        user_id=user_id,
        status=OvertimeStatus.PENDING
    )
    overtime = await overtime_repo.create_overtime(session, overtime_db)

    # Релоадим с релейшнами для уведомлений
    overtime = await overtime_repo.get_overtime_by_id(session, overtime.id)

    # Получаем менеджера и начальника для уведомления
    manager = await user_repo.get_user_by_id(session, overtime.project.manager_id)
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
    Обрабатывает решение по заявке на переработку.

    Args:
        session: Асинхронная сессия SQLAlchemy.
        overtime_id: ID заявки.
        review: Данные решения (approved, comment, as_role).
        current_user: Пользователь, принимающий решение.

    Returns:
        Обновленная заявка.
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

    # 3. Финальный пересчет статуса
    if overtime.manager_approved is False or overtime.head_approved is False:
        overtime.status = OvertimeStatus.REJECTED

    elif overtime.manager_approved is True and overtime.head_approved is True:
        overtime.status = OvertimeStatus.APPROVED

    elif overtime.manager_approved is True:
        overtime.status = OvertimeStatus.MANAGER_APPROVED

    elif overtime.head_approved is True:
        overtime.status = OvertimeStatus.HEAD_APPROVED

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
            "description": overtime.description
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
    Отменяет заявку на переработку.

    Может отменить:
    - Сам сотрудник (только свою заявку)
    - Администратор (любую заявку)
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
    
    # Убираем таймзоны
    if update_data.get("start_time") and update_data["start_time"].tzinfo:
        update_data["start_time"] = update_data["start_time"].replace(tzinfo=None)
    if update_data.get("end_time") and update_data["end_time"].tzinfo:
        update_data["end_time"] = update_data["end_time"].replace(tzinfo=None)

    # При изменении сбрасываем согласование и статус (если не админ меняет технически)
    if current_user.role != UserRole.admin:
        update_data["manager_approved"] = None
        update_data["head_approved"] = None
        update_data["status"] = OvertimeStatus.PENDING

    return await overtime_repo.update_overtime(session, overtime, update_data)
