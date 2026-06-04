from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.overtime import OvertimeCreate, OvertimeResponse, OvertimeReview, OvertimeUpdate, PersonalStats, PaginatedOvertimeResponse
from app.models.overtime import Overtime, OvertimeStatus
from app.services import overtime as overtime_service
from app.repositories import overtime as overtime_repo
from app.repositories import audit as audit_repo
from sqlalchemy import select, delete as sql_delete


router = APIRouter(prefix="/overtimes", tags=["overtimes"])


@router.get("/", response_model=PaginatedOvertimeResponse)
async def list_overtimes(
    page: int = 1,
    page_size: int = 15,
    status: OvertimeStatus | None = None,
    project_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    view: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список заявок на переработку с пагинацией, фильтрами по статусу, проекту и периоду дат.
    """
    return await overtime_repo.get_overtimes(
        session, 
        current_user, 
        status=status, 
        project_id=project_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
        view=view
    )


@router.get("/stats/me", response_model=PersonalStats)
async def get_my_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Получить личную статистику переработок.
    """
    return await overtime_repo.get_personal_stats(session, current_user.id)


@router.post("/", response_model=OvertimeResponse)
async def create_overtime(
    overtime_in: OvertimeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Создать новую заявку на переработку.

    Доступно любому авторизованному сотруднику.
    По умолчанию заявка создается в статусе PENDING.
    """
    return await overtime_service.create_new_overtime(session, overtime_in, current_user.id)



@router.get("/{overtime_id}", response_model=OvertimeResponse)
async def get_overtime(
    overtime_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Получить детальную информацию о конкретной заявке.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    return overtime


@router.post("/{overtime_id}/review", response_model=OvertimeResponse)
async def review_overtime(
    overtime_id: int,
    review: OvertimeReview,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Согласовать или отклонить заявку на переработку.

    - Менеджеры и Начальники отделов могут выставлять свои флаги одобрения.
    - Если любой из них отклоняет — статус становится REJECTED.
    - Если оба одобряют — статус становится APPROVED.
    - Имеются промежуточные статусы MANAGER_APPROVED и HEAD_APPROVED.
    """
    # Проверка прав: только менеджеры, начальники или админы могут согласовывать
    if current_user.role == UserRole.employee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав для согласования заявок"
        )

    return await overtime_service.review_overtime(session, overtime_id, review, current_user)


@router.post("/{overtime_id}/cancel", response_model=OvertimeResponse)
async def cancel_overtime_request(
    overtime_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Отменить заявку на переработку.

    - Сотрудник может отменить свою заявку.
    - Администратор может отменить любую.
    """
    return await overtime_service.cancel_overtime(session, overtime_id, current_user)


@router.patch("/{overtime_id}", response_model=OvertimeResponse)
async def update_overtime_request(
    overtime_id: int,
    overtime_in: OvertimeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Обновить данные заявки на переработку.

    - Сотрудник может обновлять только свои заявки в статусе PENDING.
    - Администратор может обновлять любые.
    """
    return await overtime_service.update_overtime(session, overtime_id, overtime_in, current_user)


@router.delete("/{overtime_id}", status_code=204)
async def delete_overtime_admin(
    overtime_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Полностью удалить заявку на переработку.

    Доступно только администраторам.
    Используется в исключительных случаях (тест, дубликат и т.д.).
    Действие логируется в аудит.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удаление заявок доступно только администраторам"
        )

    result = await session.execute(select(Overtime).where(Overtime.id == overtime_id))
    overtime = result.scalar_one_or_none()
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    await audit_repo.create_audit_log(
        session,
        current_user.id,
        "DELETE_OVERTIME",
        "overtime",
        overtime_id,
        {"user_id": overtime.user_id, "status": str(overtime.status)}
    )

    await session.execute(sql_delete(Overtime).where(Overtime.id == overtime_id))
    await session.commit()

