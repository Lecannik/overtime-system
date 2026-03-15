from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.overtime import OvertimeCreate, OvertimeResponse, OvertimeReview, OvertimeUpdate, PersonalStats
from app.services import overtime as overtime_service
from app.repositories import overtime as overtime_repo


router = APIRouter(prefix="/overtimes", tags=["overtimes"])


@router.get("/stats/me", response_model=PersonalStats)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить личную статистику переработок.
    """
    return await overtime_repo.get_personal_stats(db, current_user.id)


@router.post("/", response_model=OvertimeResponse)
async def create_overtime(
    overtime_in: OvertimeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Создать новую заявку на переработку.

    Доступно любому авторизованному сотруднику.
    По умолчанию заявка создается в статусе PENDING.
    """
    return await overtime_service.create_new_overtime(db, overtime_in, current_user.id)


@router.get("/", response_model=List[OvertimeResponse])
async def list_overtimes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список заявок на переработку.

    - Сотрудник видит только свои заявки.
    - Менеджер проекта видит свои и заявки по своим проектам.
    - Начальник отдела видит заявки сотрудников своего отдела.
    - Администратор видит всё.
    """
    return await overtime_repo.get_overtimes(db, current_user)


@router.get("/{overtime_id}", response_model=OvertimeResponse)
async def get_overtime(
    overtime_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить детальную информацию о конкретной заявке.
    """
    overtime = await overtime_repo.get_overtime_by_id(db, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    return overtime


@router.post("/{overtime_id}/review", response_model=OvertimeResponse)
async def review_overtime(
    overtime_id: int,
    review: OvertimeReview,
    db: AsyncSession = Depends(get_db),
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

    return await overtime_service.review_overtime(db, overtime_id, review, current_user)


@router.post("/{overtime_id}/cancel", response_model=OvertimeResponse)
async def cancel_overtime_request(
    overtime_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Отменить заявку на переработку.

    - Сотрудник может отменить свою заявку.
    - Администратор может отменить любую.
    """
    return await overtime_service.cancel_overtime(db, overtime_id, current_user)


@router.patch("/{overtime_id}", response_model=OvertimeResponse)
async def update_overtime_request(
    overtime_id: int,
    overtime_in: OvertimeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Обновить данные заявки на переработку.

    - Сотрудник может обновлять только свои заявки в статусе PENDING.
    - Администратор может обновлять любые.
    """
    return await overtime_service.update_overtime(db, overtime_id, overtime_in, current_user)
