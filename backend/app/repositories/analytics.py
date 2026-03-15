from sqlalchemy import select, func, text, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.overtime import Overtime, OvertimeStatus
from app.models.organization import Project, Department
from app.models.user import User
from typing import List, Dict, Any
import math
from datetime import datetime, timedelta, timezone
from app.core.utils import calculate_overtime_hours, strip_timezone

# Выражение для расчета длительности переработки на стороне базы данных (SQL).
# Важно: логика округления (CEIL) должна совпадать с calculate_overtime_hours в Python.
DURATION_EXPR = func.sum(
    func.ceil(func.extract('epoch', Overtime.end_time - Overtime.start_time) / 3600)
)

def apply_date_filters(query, start_date: datetime | None, end_date: datetime | None):
    """Применяет фильтры по датам к SQLAlchemy запросу."""
    if start_date:
        query = query.where(Overtime.start_time >= start_date)
    if end_date:
        query = query.where(Overtime.start_time <= end_date)
    return query


async def get_user_weekly_stats(session: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """Получает статистику по часам за последние 7 дней для графика тенденций."""
    today = datetime.now(timezone.utc).date()
    seven_days_ago = today - timedelta(days=7)
    
    # Группируем по дням
    query = select(
        func.date(Overtime.start_time).label("day"),
        DURATION_EXPR.label("hours")
    ).where(
        and_(
            Overtime.user_id == user_id,
            Overtime.status == OvertimeStatus.APPROVED,
            func.date(Overtime.start_time) >= seven_days_ago
        )
    ).group_by(func.date(Overtime.start_time)).order_by(func.date(Overtime.start_time))
    
    result = await session.execute(query)
    rows = result.all()
    
    # Подготавливаем данные для всех 7 дней (даже если там 0 часов)
    stats = []
    days_map = {row.day: row.hours for row in rows}
    
    for i in range(7, -1, -1):
        d = today - timedelta(days=i)
        stats.append({
            "name": d.strftime("%d.%m"),
            "hours": float(days_map.get(d, 0))
        })
        
    return stats

async def get_analytics_summary(
    session: AsyncSession, 
    manager_id: int | None = None,
    department_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> Dict[str, Any]:
    """
    Получает сводную аналитику по переработкам с фильтрацией по датам.
    """
    start_date = strip_timezone(start_date)
    end_date = strip_timezone(end_date)

    query = select(
        func.coalesce(DURATION_EXPR, 0).label("total_hours"),
        func.count(Overtime.id).label("total_requests"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.PENDING).label("pending"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.APPROVED).label("approved"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.REJECTED).label("rejected")
    )

    if manager_id:
        query = query.join(Project).where(Project.manager_id == manager_id)
    elif department_id:
        query = query.join(User).where(User.department_id == department_id)

    query = apply_date_filters(query, start_date, end_date)

    result = await session.execute(query)
    row = result.fetchone()
    
    return {
        "total_hours": float(row.total_hours),
        "total_requests": row.total_requests,
        "pending_requests": row.pending,
        "approved_requests": row.approved,
        "rejected_requests": row.rejected
    }

async def get_project_analytics(
    session: AsyncSession, 
    manager_id: int | None = None,
    department_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> List[Dict[str, Any]]:
    """
    Получает аналитику по проектам с фильтрацией по датам.
    """
    start_date = strip_timezone(start_date)
    end_date = strip_timezone(end_date)

    query = select(
        Project.id,
        Project.name,
        func.coalesce(DURATION_EXPR, 0).label("total_hours"),
        func.count(Overtime.id).label("request_count")
    ).join(Overtime, Project.id == Overtime.project_id).group_by(Project.id, Project.name)

    if manager_id:
        query = query.where(Project.manager_id == manager_id)
    
    query = apply_date_filters(query, start_date, end_date)

    result = await session.execute(query)
    return [
        {
            "project_id": row.id,
            "project_name": row.name,
            "total_hours": float(row.total_hours),
            "request_count": row.request_count
        } for row in result.all()
    ]

async def get_department_analytics(
    session: AsyncSession,
    manager_id: int | None = None,
    department_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> List[Dict[str, Any]]:
    """
    Получает аналитику по отделам с фильтрацией по датам.
    """
    start_date = strip_timezone(start_date)
    end_date = strip_timezone(end_date)

    query = select(
        Department.id,
        Department.name,
        func.coalesce(DURATION_EXPR, 0).label("total_hours"),
        func.count(Overtime.id).label("request_count")
    ).join(User, Department.id == User.department_id)\
     .join(Overtime, User.id == Overtime.user_id)\
     .group_by(Department.id, Department.name)

    query = apply_date_filters(query, start_date, end_date)

    result = await session.execute(query)
    return [
        {
            "department_id": row.id,
            "department_name": row.name,
            "total_hours": float(row.total_hours),
            "request_count": row.request_count
        } for row in result.all()
    ]

async def get_user_analytics(
    session: AsyncSession,
    project_id: int | None = None,
    department_id: int | None = None,
    manager_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> List[Dict[str, Any]]:
    """
    Получает аналитику по пользователям. 
    Если задан project_id - только по этому проекту.
    Если задан department_id/manager_id - в рамках их полномочий.
    """
    start_date = strip_timezone(start_date)
    end_date = strip_timezone(end_date)

    query = select(
        User.id.label("user_id"),
        User.full_name,
        func.coalesce(DURATION_EXPR, 0).label("total_hours"),
        func.count(Overtime.id).label("request_count")
    ).join(Overtime, User.id == Overtime.user_id).group_by(User.id, User.full_name)

    if project_id:
        query = query.where(Overtime.project_id == project_id)
    
    if manager_id:
        # Если мы менеджер, видим только свои проекты (уже отфильтровано по project_id если он есть, 
        # но если нет - надо ограничить всеми моими проектами)
        query = query.join(Project, Overtime.project_id == Project.id).where(Project.manager_id == manager_id)
    elif department_id:
        query = query.where(User.department_id == department_id)

    query = apply_date_filters(query, start_date, end_date)

    query = query.order_by(text("total_hours DESC"))

    result = await session.execute(query)
    return [
        {
            "user_id": row.user_id,
            "full_name": row.full_name,
            "total_hours": float(row.total_hours),
            "request_count": row.request_count
        } for row in result.all()
    ]

async def get_export_data(
    session: AsyncSession,
    manager_id: int | None = None,
    department_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> List[Dict[str, Any]]:
    """Получить детальные данные для экспорта с фильтрацией."""
    start_date = strip_timezone(start_date)
    end_date = strip_timezone(end_date)

    query = select(
        Overtime.id,
        User.full_name.label("employee"),
        Project.name.label("project"),
        Overtime.start_time,
        Overtime.end_time,
        Overtime.description,
        Overtime.status
    ).join(User, Overtime.user_id == User.id)\
     .join(Project, Overtime.project_id == Project.id)

    if manager_id:
        query = query.where(Project.manager_id == manager_id)
    elif department_id:
        query = query.where(User.department_id == department_id)
    
    query = apply_date_filters(query, start_date, end_date)

    query = query.order_by(Overtime.start_time.desc())
    
    result = await session.execute(query)
    
    data = []
    for row in result.all():
        d = dict(row._asdict())
        # Используем общую функцию расчета (DRY)
        d['hours'] = calculate_overtime_hours(d['start_time'], d['end_time'])
        
        # Переводим статус, используя свойство модели (DRY)
        status_obj = d['status']
        if isinstance(status_obj, OvertimeStatus):
            d['status'] = status_obj.russian_label
        else:
            # На случай, если в d['status'] строка (хотя SQLAlchemy обычно возвращает Enum)
            try:
                d['status'] = OvertimeStatus(status_obj).russian_label
            except ValueError:
                d['status'] = str(status_obj)
        
        data.append(d)
    return data
