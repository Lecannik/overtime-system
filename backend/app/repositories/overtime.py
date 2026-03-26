"""
Репозиторий для работы с данными переработок.
Инкапсулирует SQL-логику и правила выборки данных из базы.
"""

from sqlalchemy import select, or_
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
    project_id: int | None = None
):
    """
    Получает список заявок с учетом прав доступа текущего пользователя.
    
    Логика прав:
    - Админ: видит всё.
    - Сотрудник: видит только свои заявки.
    - Менеджер/Начальник: видят свои + заявки по своим проектам/отделам.
    """
    query = select(Overtime).join(Project, Overtime.project_id == Project.id)
    query = query.join(User, Overtime.user_id == User.id)

    # Ограничение видимости по ролям
    if current_user.role == UserRole.admin:
        pass 
    elif current_user.role == UserRole.employee:
        query = query.where(Overtime.user_id == current_user.id)
    else:
        # Для руководителей: свои + подчиненные
        my_depts = select(Department.id).where(Department.head_id == current_user.id)
        query = query.where(
            or_(
                Overtime.user_id == current_user.id,        # Свои
                Project.manager_id == current_user.id,     # Проекты, где я менеджер
                User.department_id.in_(my_depts)           # Отделы, где я начальник
            )
        )

    # Дополнительные фильтры
    if status:
        query = query.where(Overtime.status == status)
    if project_id:
        query = query.where(Overtime.project_id == project_id)

    query = query.order_by(Overtime.created_at.desc())
    query = query.options(
        selectinload(Overtime.project),
        selectinload(Overtime.user)
    )
    result = await session.execute(query)
    return result.scalars().all()


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

async def update_overtime(session: AsyncSession, overtime_db: Overtime, update_data: dict) -> Overtime:
    """Обновляет поля переработки на основе словаря данных."""
    for key, value in update_data.items():
        setattr(overtime_db, key, value)
    
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db

async def get_personal_stats(session: AsyncSession, user_id: int):
    """
    Собирает статистику за текущий и прошлый месяцы 
    для отображения на дашборде пользователя.
    """
    query = (
        select(Overtime)
        .join(Project)
        .where(Overtime.user_id == user_id)
        .where(Overtime.status == OvertimeStatus.APPROVED)
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(query)
    overtimes = result.scalars().all()

    now = datetime.now()
    this_month_start = date(now.year, now.month, 1)
    
    first_this_month = date(now.year, now.month, 1)
    last_month_end = first_this_month - timedelta(days=1)
    last_month_start = date(last_month_end.year, last_month_end.month, 1)

    this_month_hours = 0.0
    last_month_hours = 0.0
    total_hours = 0.0
    project_map = defaultdict(float)

    for ot in overtimes:
        h = ot.hours
        total_hours += h
        project_map[ot.project.name] += h
        
        ot_date = ot.start_time.date()
        if ot_date >= this_month_start:
            this_month_hours += h
        elif last_month_start <= ot_date <= last_month_end:
            last_month_hours += h

    by_project = [
        {"project_name": name, "hours": h} 
        for name, h in project_map.items()
    ]

    return {
        "current_month_hours": round(this_month_hours, 1),
        "last_month_hours": round(last_month_hours, 1),
        "total_hours": round(total_hours, 1),
        "by_project": by_project
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
        or_(
            (Overtime.start_time <= start_time) & (Overtime.end_time > start_time),
            (Overtime.start_time < end_time) & (Overtime.end_time >= end_time),
            (Overtime.start_time >= start_time) & (Overtime.end_time <= end_time)
        )
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
