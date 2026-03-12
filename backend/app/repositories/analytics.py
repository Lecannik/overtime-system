from sqlalchemy import select, func, text, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.overtime import Overtime, OvertimeStatus
from app.models.organization import Project, Department
from app.models.user import User
from typing import List, Dict, Any

async def get_analytics_summary(
    session: AsyncSession, 
    manager_id: int | None = None,
    department_id: int | None = None
) -> Dict[str, Any]:
    """
    Получает сводную аналитику по переработкам.
    
    Args:
        session: Асинхронная сессия SQLAlchemy.
        manager_id: ID менеджера (опционально).
        department_id: ID отдела (опционально).
    
    Returns:
        Сводная статистика по переработкам.
    """
    # Duration calculation in hours
    duration_stmt = func.sum(
        func.extract('epoch', Overtime.end_time - Overtime.start_time)
    ) / 3600

    query = select(
        func.coalesce(duration_stmt, 0).label("total_hours"),
        func.count(Overtime.id).label("total_requests"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.PENDING).label("pending"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.APPROVED).label("approved"),
        func.count(Overtime.id).filter(Overtime.status == OvertimeStatus.REJECTED).label("rejected")
    )

    if manager_id:
        query = query.join(Project).where(Project.manager_id == manager_id)
    elif department_id:
        query = query.join(User).where(User.department_id == department_id)

    result = await session.execute(query)
    row = result.fetchone()
    
    return {
        "total_hours": float(row.total_hours),
        "total_requests": row.total_requests,
        "pending_requests": row.pending,
        "approved_requests": row.approved,
        "rejected_requests": row.rejected
    }

async def get_project_analytics(session: AsyncSession, manager_id: int | None = None) -> List[Dict[str, Any]]:
    """
    Получает аналитику по проектам.
    
    Args:
        session: Асинхронная сессия SQLAlchemy.
        manager_id: ID менеджера (опционально).
    
    Returns:
        Список проектов с аналитикой по переработкам.
    """
    duration_stmt = func.sum(
        func.extract('epoch', Overtime.end_time - Overtime.start_time)
    ) / 3600

    query = select(
        Project.id,
        Project.name,
        func.coalesce(duration_stmt, 0).label("total_hours"),
        func.count(Overtime.id).label("request_count")
    ).join(Overtime, Project.id == Overtime.project_id).group_by(Project.id, Project.name)

    if manager_id:
        query = query.where(Project.manager_id == manager_id)

    result = await session.execute(query)
    return [
        {
            "project_id": row.id,
            "project_name": row.name,
            "total_hours": float(row.total_hours),
            "request_count": row.request_count
        } for row in result.all()
    ]

async def get_department_analytics(session: AsyncSession) -> List[Dict[str, Any]]:
    """
    Получает аналитику по отделам.
    
    Args:
        session: Асинхронная сессия SQLAlchemy.
    
    Returns:
        Список отделов с аналитикой по переработкам.
    """
    duration_stmt = func.sum(
        func.extract('epoch', Overtime.end_time - Overtime.start_time)
    ) / 3600

    query = select(
        Department.id,
        Department.name,
        func.coalesce(duration_stmt, 0).label("total_hours"),
        func.count(Overtime.id).label("request_count")
    ).join(User, Department.id == User.department_id)\
     .join(Overtime, User.id == Overtime.user_id)\
     .group_by(Department.id, Department.name)

    result = await session.execute(query)
    return [
        {
            "department_id": row.id,
            "department_name": row.name,
            "total_hours": float(row.total_hours),
            "request_count": row.request_count
        } for row in result.all()
    ]
