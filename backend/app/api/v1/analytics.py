"""
Модуль содержит эндпоинты для получения аналитики по переработкам.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.analytics import AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics
from app.repositories import analytics as analytics_repo

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить сводную статистику по переработкам.
    
    - Админ: видит всё.
    - Менеджер: видит по своим проектам.
    - Начальник отдела: видит по своему отделу.
    """
    if current_user.role == UserRole.admin:
        return await analytics_repo.get_analytics_summary(db)
    elif current_user.role == UserRole.manager:
        return await analytics_repo.get_analytics_summary(db, manager_id=current_user.id)
    elif current_user.role == UserRole.head:
        return await analytics_repo.get_analytics_summary(db, department_id=current_user.department_id)
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

@router.get("/projects", response_model=List[ProjectAnalytics])
async def get_projects_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Статистика в разрезе проектов."""
    if current_user.role == UserRole.admin:
        return await analytics_repo.get_project_analytics(db)
    elif current_user.role == UserRole.manager:
        return await analytics_repo.get_project_analytics(db, manager_id=current_user.id)
    else:
        # Начальники отделов видят все проекты, где задействованы их люди (упростим до админ-доступа или запретим)
        if current_user.role == UserRole.head:
             return await analytics_repo.get_project_analytics(db) # Для головы отдела дадим общий доступ пока
        raise HTTPException(status_code=403, detail="Доступ запрещен")

@router.get("/departments", response_model=List[DepartmentAnalytics])
async def get_departments_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Статистика в разрезе отделов (только для Админов и Голов отделов)."""
    if current_user.role not in [UserRole.admin, UserRole.head]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    return await analytics_repo.get_department_analytics(db)
