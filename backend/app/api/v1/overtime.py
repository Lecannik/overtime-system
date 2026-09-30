from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

# pyrefly: ignore [missing-import]
from sqlalchemy import delete as sql_delete, select

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_session
from app.core.rate_limit import overtime_create_limiter
from app.models.organization import Department
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User, UserRole
from app.repositories import audit as audit_repo, organization as org_repo, overtime as overtime_repo, user as user_repo
from app.schemas.overtime import (
    OvertimeCreate,
    OvertimeResponse,
    OvertimeReview,
    OvertimeUpdate,
    PaginatedOvertimeResponse,
    PersonalStats,
    StartSessionRequest,
    StopSessionRequest,
)
from app.services import overtime as overtime_service

router = APIRouter(prefix="/overtimes", tags=["overtimes"])


@router.get("/active", response_model=Optional[OvertimeResponse])
async def get_active_session(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Получить текущую активную сессию (IN_PROGRESS) текущего пользователя.
    Используется в Telegram Mini App и мобильном трекере.
    """
    return await overtime_repo.get_active_session(session, current_user.id)


@router.post("/start-session", response_model=OvertimeResponse)
async def start_session(
    payload: StartSessionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Запустить активную сессию переработки (IN_PROGRESS).
    """
    existing = await overtime_repo.get_active_session(session, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас уже запущена переработка. Завершите текущую перед запуском новой.",
        )

    project = await org_repo.get_project_by_id(session, payload.project_id)
    if not project or not project.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Выбранный проект не существует или неактивен.",
        )

    new_ot = Overtime(
        user_id=current_user.id,
        project_id=payload.project_id,
        start_time=datetime.now(timezone.utc),
        start_lat=payload.lat,
        start_lng=payload.lng,
        location_name=payload.location_name,
        description=(payload.description or "").strip() or "[В процессе]",
        status=OvertimeStatus.IN_PROGRESS,
    )
    await overtime_repo.create_overtime(session, new_ot)
    return await overtime_repo.get_overtime_by_id(session, new_ot.id)


@router.post("/stop-session", response_model=OvertimeResponse)
async def stop_session(
    payload: StopSessionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Завершить активную сессию переработки, зафиксировать время и перевести в PENDING.
    Комментарий по фактически выполненным работам обязателен.
    """
    active = await overtime_repo.get_active_session(session, current_user.id)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Активная сессия не найдена.",
        )

    comment_text = (payload.comment or "").strip()
    if not comment_text:
        if active.description and active.description.strip() not in (
            "",
            "[В процессе]",
            "[Telegram Mini App]",
            "[Бот]",
        ):
            comment_text = active.description.strip()
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Комментарий по выполненным работам обязателен при завершении переработки.",
            )
    elif active.description and active.description.strip() not in ("", "[В процессе]", "[Telegram Mini App]", "[Бот]"):
        start_desc = active.description.strip()
        if start_desc != comment_text:
            comment_text = f"{start_desc}\nЗавершение: {comment_text}"

    end_time = datetime.now(timezone.utc)
    from app.core.utils import split_interval_by_days

    intervals = split_interval_by_days(active.start_time, end_time)
    if not intervals:
        intervals = [(active.start_time, end_time)]

    active.start_time = intervals[0][0]
    active.end_time = intervals[0][1]
    active.description = comment_text
    active.status = OvertimeStatus.PENDING
    active.end_lat = payload.lat
    active.end_lng = payload.lng

    other_overtimes = []
    for s, e in intervals[1:]:
        new_ot = Overtime(
            user_id=active.user_id,
            project_id=active.project_id,
            start_time=s,
            end_time=e,
            description=comment_text,
            location_name=active.location_name,
            start_lat=active.start_lat,
            start_lng=active.start_lng,
            end_lat=payload.lat,
            end_lng=payload.lng,
            status=OvertimeStatus.PENDING,
        )
        session.add(new_ot)
        other_overtimes.append(new_ot)

    await session.commit()

    all_overtimes = [active]
    for ot in other_overtimes:
        ot_full = await overtime_repo.get_overtime_by_id(session, ot.id)
        if ot_full:
            all_overtimes.append(ot_full)

    from app.services import notifications

    for ot_full in all_overtimes:
        manager = None
        if ot_full.project and ot_full.project.manager_id:
            manager = await user_repo.get_user_by_id(session, ot_full.project.manager_id)
        dept = (
            await org_repo.get_department_by_id(session, ot_full.user.department_id)
            if ot_full.user.department_id
            else None
        )
        head = await user_repo.get_user_by_id(session, dept.head_id) if dept and dept.head_id else None
        await notifications.notify_new_overtime(session, ot_full, manager, head)

    return await overtime_repo.get_overtime_by_id(session, active.id)


@router.get("/", response_model=PaginatedOvertimeResponse)
async def list_overtimes(
    page: int = Query(1, ge=1, description="Номер страницы (>= 1)"),
    page_size: int = Query(15, ge=1, le=100, description="Размер страницы (1-100)"),
    status: OvertimeStatus | None = None,
    project_id: int | None = None,
    department_id: Optional[int] = None,
    start_date: date | None = None,
    end_date: date | None = None,
    view: str | None = None,
    search: Optional[str] = None,
    preset: Optional[str] = Query(None, description="Смарт-пресет: 'action_required' | 'in_review'"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Получить список заявок на переработку с пагинацией, фильтрами по статусу, проекту, периоду дат, смарт-пресетам и поисковому запросу.
    """
    return await overtime_repo.get_overtimes(
        session,
        current_user,
        status=status,
        project_id=project_id,
        department_id=department_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
        view=view,
        search=search,
        preset=preset,
    )


@router.get("/stats/me", response_model=PersonalStats)
async def get_my_stats(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    """
    Получить личную статистику переработок.
    """
    return await overtime_repo.get_personal_stats(session, current_user.id)


@router.get("/calendar-summary", response_model=Dict[str, Any])
async def get_calendar_summary(
    month: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[OvertimeStatus] = None,
    preset: Optional[str] = Query(None, description="Смарт-пресет: 'action_required' | 'in_review'"),
    department_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Получить сводку заявок по дням для отображения в календарном виде (heatmap) с фильтрацией по статусу, пресету и отделу.

    Параметры:
        - month: строка формата 'YYYY-MM' (например '2026-07').
        - year: год (например 2026) для годовой/квартальной выборки.
        - status: конкретный статус заявки.
        - preset: смарт-пресет ('action_required' | 'in_review').
        - department_id: ID отдела.

    Возвращает словарь с ключами 'YYYY-MM-DD' и объектами:
    {'total', 'pending', 'approved', 'hours', 'entries'}.
    Доступность данных ограничена ролью текущего пользователя.
    """
    if current_user.role == UserRole.employee:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return await overtime_repo.get_calendar_summary(
        session, current_user, month=month, year=year, status=status, preset=preset, department_id=department_id
    )


@router.post("/", response_model=OvertimeResponse)
async def create_overtime(
    request: Request,
    overtime_in: OvertimeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    overtime_create_limiter.check_limit(request)
    """
    Создать новую заявку на переработку.

    Доступно любому авторизованному сотруднику.
    По умолчанию заявка создается в статусе PENDING.
    """
    return await overtime_service.create_new_overtime(session, overtime_in, current_user.id)


@router.get("/{overtime_id}", response_model=OvertimeResponse)
async def get_overtime(
    overtime_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    """
    Получить детальную информацию о конкретной заявке.
    Доступ разрешен только:
    - автору заявки;
    - администратору;
    - менеджеру проекта заявки;
    - руководителю отдела автора заявки.
    """
    overtime = await overtime_repo.get_overtime_by_id(session, overtime_id)
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Проверка прав доступа (BOLA / IDOR Protection)
    if current_user.role != UserRole.admin and overtime.user_id != current_user.id:
        is_manager = bool(overtime.project and overtime.project.manager_id == current_user.id)
        is_head = False
        if overtime.user and overtime.user.department_id:
            dept_res = await session.execute(select(Department).where(Department.id == overtime.user.department_id))
            dept = dept_res.scalar_one_or_none()
            if dept and dept.head_id == current_user.id:
                is_head = True

        if not (is_manager or is_head):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещен. Вы можете просматривать только свои заявки или заявки подотчетных сотрудников.",
            )

    return overtime


@router.post("/{overtime_id}/review", response_model=OvertimeResponse)
async def review_overtime(
    overtime_id: int,
    review: OvertimeReview,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="У вас нет прав для согласования заявок")

    return await overtime_service.review_overtime(session, overtime_id, review, current_user)


@router.post("/{overtime_id}/cancel", response_model=OvertimeResponse)
async def cancel_overtime_request(
    overtime_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    """
    Отменить заявку на переработку.

    - Сотрудник может отменить свою заявку.
    - Администратор может отменить любую.
    """
    return await overtime_service.cancel_overtime(session, overtime_id, current_user)


@router.post("/{overtime_id}/restore", response_model=OvertimeResponse)
async def restore_overtime_request(
    overtime_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    """
    Восстановить отменённую заявку.

    - Переводит заявку из CANCELLED в PENDING.
    - Сбрасывает все результаты согласования.
    - Доступно владельцу или администратору.
    """
    return await overtime_service.restore_overtime(session, overtime_id, current_user)


@router.patch("/{overtime_id}", response_model=OvertimeResponse)
async def update_overtime_request(
    overtime_id: int,
    overtime_in: OvertimeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Обновить данные заявки на переработку.

    - Сотрудник может обновлять только свои заявки в статусе PENDING.
    - Администратор может обновлять любые.
    """
    return await overtime_service.update_overtime(session, overtime_id, overtime_in, current_user)


@router.delete("/{overtime_id}", status_code=204)
async def delete_overtime_admin(
    overtime_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    """
    Полностью удалить заявку на переработку.

    Доступно только администраторам.
    Используется в исключительных случаях (тест, дубликат и т.д.).
    Действие логируется в аудит.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Удаление заявок доступно только администраторам"
        )

    result = await session.execute(select(Overtime).where(Overtime.id == overtime_id))
    overtime = result.scalar_one_or_none()
    if not overtime:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    target_user = await session.get(User, overtime.user_id)
    await audit_repo.create_audit_log(
        session,
        current_user.id,
        "DELETE_OVERTIME",
        "overtime",
        overtime_id,
        {
            "user_id": overtime.user_id,
            "employee_id": overtime.user_id,
            "employee_name": target_user.full_name if target_user else None,
            "employee_email": target_user.email if target_user else None,
            "status": str(overtime.status),
        },
    )

    await session.execute(sql_delete(Overtime).where(Overtime.id == overtime_id))
    await session.commit()
