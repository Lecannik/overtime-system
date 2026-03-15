from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.overtime import Overtime, OvertimeStatus
from app.models.organization import Project, Department
from app.models.user import User, UserRole

async def create_overtime(session: AsyncSession, overtime_db: Overtime) -> Overtime:
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
    query = select(Overtime).join(Project, Overtime.project_id == Project.id)
    query = query.join(User, Overtime.user_id == User.id)

    # --- 1. ПРАВА ДОСТУПА (Access Control) ---
    
    if current_user.role == UserRole.admin:
        pass 

    elif current_user.role == UserRole.employee:
        query = query.where(Overtime.user_id == current_user.id)

    else:
        # Менеджер проекта OR Начальник отдела
        
        # Подзапрос: отделы, где юзер - начальник
        my_depts = select(Department.id).where(Department.head_id == current_user.id)
        
        query = query.where(
            or_(
                Overtime.user_id == current_user.id,        # Свои заявки
                Project.manager_id == current_user.id,     # Я менеджер этого ПРОЕКТА
                User.department_id.in_(my_depts)           # Сотрудник из МОЕГО ОТДЕЛА
            )
        )

    # --- 2. ПОЛЬЗОВАТЕЛЬСКИЕ ФИЛЬТРЫ ---
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
    query = (
        select(Overtime)
        .where(Overtime.id == overtime_id)
        .options(
            selectinload(Overtime.project),    # для проверки manager_id
            selectinload(Overtime.user),       # для проверки department_id
        )
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()
async def update_overtime(session: AsyncSession, overtime_db: Overtime, update_data: dict) -> Overtime:
    for key, value in update_data.items():
        setattr(overtime_db, key, value)
    
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db


from datetime import datetime, date, timedelta
from collections import defaultdict

async def get_personal_stats(session: AsyncSession, user_id: int):
    # Получаем все APPROVED заявки пользователя
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
    
    # Прошлый месяц
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
        "current_month_hours": this_month_hours,
        "last_month_hours": last_month_hours,
        "total_hours": total_hours,
        "by_project": by_project
    }
