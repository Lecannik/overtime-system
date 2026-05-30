from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.audit import PaginatedAuditResponse
from app.repositories import audit as audit_repo

router = APIRouter()

@router.get("/", response_model=PaginatedAuditResponse)
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Получить записи журнала аудита с пагинацией и поиском.
    Доступно только администраторам.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для просмотра журналов аудита"
        )
    
    logs_data = await audit_repo.get_audit_logs(session, limit, offset, search)
    return logs_data
