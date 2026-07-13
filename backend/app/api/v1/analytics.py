"""
Модуль содержит эндпоинты для получения аналитики по переработкам.
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User, UserRole, UserCompany
from app.schemas.analytics import AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics, UserAnalytics, ReviewAnalytics
from app.repositories import analytics as analytics_repo
from app.services.excel_service import generate_excel_file
from app.core.cache import cache_get, cache_set

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _ck(scope: dict, **params) -> dict:
    """Builds cache-key kwargs from scope + filter params."""
    return {
        "scope": f"{scope.get('manager_id')}:{scope.get('department_ids')}",
        **{k: str(v) for k, v in params.items()},
    }


async def get_analytics_scope(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Зависимость для определения области видимости (scope) данных в аналитике.
    Возвращает словарь с фильтрами (manager_id, department_ids), которые нужно применить.
    """
    if current_user.role == UserRole.admin:
        return {"manager_id": None, "department_ids": None}
    
    if current_user.role == UserRole.manager:
        return {"manager_id": current_user.id, "department_ids": None}
    
    if current_user.role == UserRole.head:
        from app.models.organization import Department
        from sqlalchemy import select
        dept_res = await session.execute(
            select(Department.id).where(Department.head_id == current_user.id)
        )
        dept_ids = [row[0] for row in dept_res.all()]
        return {"manager_id": None, "department_ids": dept_ids}
        
    raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера, начальника или админа.")

@router.get("/reviews", response_model=ReviewAnalytics)
async def get_reviews_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    scope: dict = Depends(get_analytics_scope)
):
    """Аналитика по качеству согласования (запрошено vs одобрено)."""
    ck = _ck(scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    hit, data = cache_get("reviews", **ck)
    if hit:
        return data
    data = await analytics_repo.get_review_analytics(session, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    cache_set("reviews", data, ttl=300, **ck)
    return data

@router.get("/weekly")
async def get_weekly_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Статистика за текущую неделю для текущего пользователя."""
    return await analytics_repo.get_user_weekly_stats(session, current_user.id)

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    scope: dict = Depends(get_analytics_scope)
):
    """Общая сводка по переработкам (всего часов, заявок и т.д.)."""
    ck = _ck(scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    hit, data = cache_get("summary", **ck)
    if hit:
        return data
    data = await analytics_repo.get_analytics_summary(session, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    cache_set("summary", data, ttl=300, **ck)
    return data


@router.get("/companies")
async def get_companies_comparison(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Сравнительный отчет по компаниям (Доступно только Админам)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для администраторов.")
    ck = _ck({}, start_date=start_date, end_date=end_date)
    hit, data = cache_get("companies", **ck)
    if hit:
        return data
    data = await analytics_repo.get_company_comparison(session, start_date=start_date, end_date=end_date)
    cache_set("companies", data, ttl=300, **ck)
    return data

@router.get("/projects", response_model=List[ProjectAnalytics])
async def get_projects_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе проектов."""
    ck = _ck(scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    hit, data = cache_get("projects", **ck)
    if hit:
        return data
    data = await analytics_repo.get_project_analytics(session, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    cache_set("projects", data, ttl=300, **ck)
    return data

@router.get("/departments", response_model=List[DepartmentAnalytics])
async def get_departments_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе отделов."""
    ck = _ck(scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    hit, data = cache_get("departments", **ck)
    if hit:
        return data
    data = await analytics_repo.get_department_analytics(session, **scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    cache_set("departments", data, ttl=300, **ck)
    return data

@router.get("/users", response_model=List[UserAnalytics])
async def get_users_stats(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе пользователей (с возможностью фильтрации по проекту)."""
    ck = _ck(scope, project_id=project_id, company=company, start_date=start_date, end_date=end_date)
    hit, data = cache_get("users", **ck)
    if hit:
        return data
    data = await analytics_repo.get_user_analytics(session, project_id=project_id, company=company, **scope, start_date=start_date, end_date=end_date)
    cache_set("users", data, ttl=300, **ck)
    return data

@router.get("/export")
async def export_analytics(
    project_id: int | None = None,
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    scope: dict = Depends(get_analytics_scope)
):
    """Экспорт данных для руководителей и админов."""
    return await generate_excel_response(
        session, current_user, scope, project_id, company, start_date, end_date
    )

@router.get("/export/me")
@router.get("/export-my")
async def export_my_analytics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Персональный экспорт данных пользователя."""
    scope = {"user_id": current_user.id}
    return await generate_excel_response(
        session, current_user, scope, None, None, start_date, end_date, is_personal=True
    )

async def generate_excel_response(
    session: AsyncSession,
    current_user: User,
    scope: dict,
    project_id: int | None,
    company: UserCompany | None,
    start_date: datetime | None,
    end_date: datetime | None,
    is_personal: bool = False
):
    from app.core.config import settings
    from datetime import timezone
    
    # Приводим naive datetime (из query params) к UTC через часовой пояс организации,
    # а timezone-aware datetime просто смещаем в UTC.
    if start_date:
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=settings.tz_info).astimezone(timezone.utc)
        else:
            start_date = start_date.astimezone(timezone.utc)
            
    if end_date:
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=settings.tz_info).astimezone(timezone.utc)
        else:
            end_date = end_date.astimezone(timezone.utc)

    data = await analytics_repo.get_export_data(
        session, 
        **scope,
        project_id=project_id,
        company=company,
        start_date=start_date,
        end_date=end_date
    )
    
    if not data:
        raise HTTPException(status_code=404, detail="Нет данных для экспорта")
        
    output = await generate_excel_file(data, current_user, is_personal=is_personal, start_date=start_date, end_date=end_date)
    
    filename = f"personal_report_{datetime.now().strftime('%Y%m%d')}.xlsx" if is_personal else f"overtime_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=output.getvalue(),
        headers=headers,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
