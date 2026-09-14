from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.audit import PaginatedAuditResponse
from app.repositories import audit as audit_repo
from app.services.audit_export_service import generate_audit_excel_file

router = APIRouter()


def _normalize_date(dt: datetime | None) -> datetime | None:
    """
    Приводит naive datetime к UTC через часовой пояс организации,
    а timezone-aware datetime преобразует в UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=settings.tz_info).astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/", response_model=PaginatedAuditResponse)
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=1000, description="Количество записей (1-1000)"),
    offset: int = Query(0, ge=0, description="Смещение (>= 0)"),
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Получить записи журнала аудита с пагинацией, полнотекстовым поиском и фильтрацией по датам/категориям.
    Доступно только администраторам системы.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для просмотра журналов аудита"
        )

    norm_start = _normalize_date(start_date)
    norm_end = _normalize_date(end_date)

    logs_data = await audit_repo.get_audit_logs(
        session=session,
        limit=limit,
        offset=offset,
        search=search,
        start_date=norm_start,
        end_date=norm_end,
        category=category
    )
    return logs_data


@router.get("/export")
async def export_audit_logs(
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Выгрузить отчет по журналу аудита за указанный период в формате Excel (.xlsx).
    Доступно только администраторам системы.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для выгрузки отчета аудита"
        )

    norm_start = _normalize_date(start_date)
    norm_end = _normalize_date(end_date)

    items = await audit_repo.get_audit_logs_for_export(
        session=session,
        search=search,
        start_date=norm_start,
        end_date=norm_end,
        category=category
    )

    if not items:
        raise HTTPException(
            status_code=404,
            detail="Нет записей аудита за выбранный период для выгрузки"
        )

    output = await generate_audit_excel_file(
        items=items,
        current_user=current_user,
        start_date=norm_start,
        end_date=norm_end
    )

    filename = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Access-Control-Expose-Headers": "Content-Disposition"
    }

    return Response(
        content=output.getvalue(),
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

