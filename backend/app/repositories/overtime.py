"""
Репозиторий для работы с данными переработок.
Инкапсулирует SQL-логику и правила выборки данных из базы.
"""

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timedelta
from collections import defaultdict
from app.models.overtime import Overtime, OvertimeStatus
from app.models.organization import Project, Department
from app.models.user import User, UserRole

async def create_overtime(session: AsyncSession, overtime_db: Overtime) -> Overtime:
    """Сохраняет новую модель переработки в базу данных."""
    session.add(overtime_db)
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db

async def get_overtimes(
    session: AsyncSession, 
    current_user: User,
    status: OvertimeStatus | None = None,
    project_id: int | None = None,
    page: int = 1,
    page_size: int = 15
):
    """
    Получает список заявок с учетом прав доступа текущего пользователя и пагинации.
    """
    # Базовый запрос
    base_query = select(Overtime).join(Project, Overtime.project_id == Project.id)
    base_query = base_query.join(User, Overtime.user_id == User.id)

    # Ограничение видимости по ролям
    filters = []
    if current_user.role == UserRole.admin:
        pass 
    elif current_user.role == UserRole.employee:
        filters.append(Overtime.user_id == current_user.id)
    else:
        # Для руководителей: свои + подчиненные
        my_depts = select(Department.id).where(Department.head_id == current_user.id)
        filters.append(
            or_(
                Overtime.user_id == current_user.id,        # Свои
                Project.manager_id == current_user.id,     # Проекты, где я менеджер
                User.department_id.in_(my_depts)           # Отделы, где я начальник
            )
        )

    # Дополнительные фильтры
    if status:
        filters.append(Overtime.status == status)
    if project_id:
        filters.append(Overtime.project_id == project_id)

    # Применяем фильтры
    if filters:
        base_query = base_query.where(*filters)

    # 1. Считаем общее количество
    total_query = select(func.count(Overtime.id))
    if filters:
        # For the total count query, we need to re-apply joins if filters depend on them
        # This is a common pattern when building complex queries with dynamic joins/filters
        total_query = total_query.join(Project, Overtime.project_id == Project.id)\
                                 .join(User, Overtime.user_id == User.id)\
                                 .where(*filters)
    total_result = await session.execute(total_query)
    total = total_result.scalar()

    # 2. Получаем данные (пагинация)
    query = base_query.order_by(Overtime.created_at.desc())
    query = query.options(
        selectinload(Overtime.project),
        selectinload(Overtime.user)
    )
    
    if page_size > 0:
        query = query.limit(page_size).offset((page - 1) * page_size)

    result = await session.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size > 0 else 1
    }


async def get_overtime_by_id(session: AsyncSession, overtime_id: int) -> Overtime | None:
    """Получает одну заявку по ID с подгрузкой связанных данных проекта и пользователя."""
    query = (
        select(Overtime)
        .where(Overtime.id == overtime_id)
        .options(
            selectinload(Overtime.project),
            selectinload(Overtime.user),
        )
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()

async def get_active_session(session: AsyncSession, user_id: int) -> Overtime | None:
    """Ищет активную сессию (статус IN_PROGRESS) для конкретного пользователя."""
    query = (
        select(Overtime)
        .where(
            Overtime.user_id == user_id,
            Overtime.status == OvertimeStatus.IN_PROGRESS
        )
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()

async def update_overtime(session: AsyncSession, overtime_db: Overtime, update_data: dict) -> Overtime:
    """Обновляет поля переработки на основе словаря данных."""
    for key, value in update_data.items():
        setattr(overtime_db, key, value)
    
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db

async def get_personal_stats(session: AsyncSession, user_id: int):
    """
    Собирает расширенную статистику для дашборда пользователя.
    """
    # 1. Получаем все заявки пользователя для расчета агрегатов
    all_query = select(Overtime).where(Overtime.user_id == user_id)
    all_res = await session.execute(all_query)
    all_overtimes = all_res.scalars().all()

    # 2. Получаем только одобренные для графиков и суммы часов (с релейшном проекта)
    approved_query = (
        select(Overtime)
        .join(Project)
        .where(Overtime.user_id == user_id)
        .where(Overtime.status == OvertimeStatus.APPROVED)
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(approved_query)
    approved_overtimes = result.scalars().all()

    now = datetime.now()
    this_month_start = date(now.year, now.month, 1)
    
    first_this_month = date(now.year, now.month, 1)
    last_month_end = first_this_month - timedelta(days=1)
    last_month_start = date(last_month_end.year, last_month_end.month, 1)

    this_month_hours = 0.0
    last_month_hours = 0.0
    total_approved_hours = 0.0
    project_map = defaultdict(float)
    daily_map = defaultdict(float)

    # Статистика за последние 30 дней
    thirty_days_ago = (now - timedelta(days=30)).date()

    for ot in approved_overtimes:
        h = ot.hours
        total_approved_hours += h
        project_map[ot.project.name] += h
        
        ot_date = ot.start_time.date()
        if ot_date >= this_month_start:
            this_month_hours += h
        elif last_month_start <= ot_date <= last_month_end:
            last_month_hours += h
            
        if ot_date >= thirty_days_ago:
            daily_map[ot_date.isoformat()] += h

    # Считаем активные (ожидающие) заявки
    # Ожидающие = PENDING (ждем нач. отдела) + промежуточные согласования (ждем менеджера)
    active_requests = len([
        ot for ot in all_overtimes 
        if ot.status in [
            OvertimeStatus.PENDING, 
            OvertimeStatus.HEAD_APPROVED,
            OvertimeStatus.MANAGER_APPROVED
        ]
    ])

    by_project = [
        {"project_name": name, "hours": h} 
        for name, h in project_map.items()
    ]
    
    daily_stats = [
        {"date": d, "hours": h}
        for d, h in sorted(daily_map.items())
    ]

    return {
        "current_month_hours": round(this_month_hours, 1),
        "last_month_hours": round(last_month_hours, 1),
        "total_approved_hours": round(total_approved_hours, 1),
        "total_requests": len(all_overtimes),
        "active_requests": active_requests,
        "projects_count": len(project_map),
        "by_project": by_project,
        "daily_stats": daily_stats
    }

async def check_overlapping_overtimes(
    session: AsyncSession, 
    user_id: int, 
    start_time: datetime, 
    end_time: datetime,
    exclude_id: int | None = None
) -> bool:
    """
    Проверяет пересечение периодов. 
    Алгоритм: если (Начало1 < Конец2) и (Конец1 > Начало2), то есть пересечение.
    """
    query = select(Overtime).where(
        Overtime.user_id == user_id,
        Overtime.status.notin_([OvertimeStatus.CANCELLED, OvertimeStatus.REJECTED]),
        (Overtime.start_time < end_time) & (Overtime.end_time > start_time)
    )
    if exclude_id:
        query = query.where(Overtime.id != exclude_id)
        
    result = await session.execute(query)
    return result.scalar_one_or_none() is not None

async def get_weekly_overtime_hours(session: AsyncSession, user_id: int, project_id: int) -> float:
    """
    Подсчет часов за текущую календарную неделю (с понедельника).
    Нужно для проверки лимитов проекта.
    """
    now = datetime.now()
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = select(Overtime).where(
        Overtime.user_id == user_id,
        Overtime.project_id == project_id,
        Overtime.status.notin_([OvertimeStatus.CANCELLED, OvertimeStatus.REJECTED]),
        Overtime.start_time >= monday
    )
    result = await session.execute(query)
    overtimes = result.scalars().all()
    
    from app.core.utils import calculate_overtime_hours
    return sum(calculate_overtime_hours(ot.start_time, ot.end_time) for ot in overtimes)
