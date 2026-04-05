"""
Модуль содержит эндпоинты для получения аналитики по переработкам.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole, UserCompany
from app.schemas.analytics import AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics, UserAnalytics, ReviewAnalytics
from app.repositories import analytics as analytics_repo

router = APIRouter(prefix="/analytics", tags=["analytics"])
 
 
async def get_analytics_scope(current_user: User = Depends(get_current_user)) -> dict:
    """
    Зависимость для определения области видимости (scope) данных в аналитике.
    Возвращает словарь с фильтрами (manager_id, department_id), которые нужно применить.
    """
    if current_user.role == UserRole.admin:
        return {"manager_id": None, "department_id": None}
    
    if current_user.role == UserRole.manager:
        return {"manager_id": current_user.id, "department_id": None}
    
    if current_user.role == UserRole.head:
        return {"manager_id": None, "department_id": current_user.department_id}
        
    raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера, начальника или админа.")

@router.get("/reviews", response_model=ReviewAnalytics)
async def get_reviews_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Аналитика по качеству согласования (запрошено vs одобрено)."""
    return await analytics_repo.get_review_analytics(db, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)

@router.get("/weekly")
async def get_weekly_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Статистика за текущую неделю для текущего пользователя."""
    return await analytics_repo.get_user_weekly_stats(db, current_user.id)

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Общая сводка по переработкам (всего часов, заявок и т.д.)."""
    return await analytics_repo.get_analytics_summary(db, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)


@router.get("/companies")
async def get_companies_comparison(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сравнительный отчет по компаниям (Доступно только Админам)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для администраторов.")
    
    return await analytics_repo.get_company_comparison(db, start_date=start_date, end_date=end_date)

@router.get("/projects", response_model=List[ProjectAnalytics])
async def get_projects_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе проектов."""
    return await analytics_repo.get_project_analytics(db, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)

@router.get("/departments", response_model=List[DepartmentAnalytics])
async def get_departments_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе отделов."""
    return await analytics_repo.get_department_analytics(db, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)

@router.get("/users", response_model=List[UserAnalytics])
async def get_users_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе пользователей (с возможностью фильтрации по проекту)."""
    return await analytics_repo.get_user_analytics(db, project_id=project_id, company=company, **scope, start_date=start_date, end_date=end_date)

@router.get("/export")
async def export_analytics(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: dict = Depends(get_analytics_scope)
):
    """Экспорт данных для руководителей и админов."""
    return await generate_excel_response(
        db, current_user, scope, project_id, company, start_date, end_date
    )

@router.get("/export/me")
async def export_my_analytics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Персональный экспорт данных пользователя."""
    scope = {"user_id": current_user.id}
    return await generate_excel_response(
        db, current_user, scope, None, None, start_date, end_date, is_personal=True
    )

async def generate_excel_response(
    db: AsyncSession,
    current_user: User,
    scope: dict,
    project_id: int | None,
    company: UserCompany | None,
    start_date: datetime | None,
    end_date: datetime | None,
    is_personal: bool = False
):
    from app.services.excel_service import generate_excel_file
    
    data = await analytics_repo.get_export_data(
        db, 
        **scope,
        project_id=project_id,
        company=company,
        start_date=start_date,
        end_date=end_date
    )
    
    if not data:
        raise HTTPException(status_code=404, detail="Нет данных для экспорта")
        
    output = await generate_excel_file(data, current_user, is_personal=is_personal)
    
    filename = f"personal_report_{datetime.now().strftime('%Y%m%d')}.xlsx" if is_personal else f"overtime_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
    headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    output.seek(0)
    filename = f"personal_report_{datetime.now().strftime('%Y%m%d')}.xlsx" if is_personal else f"overtime_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
    headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
