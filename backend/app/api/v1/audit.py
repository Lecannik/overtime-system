from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.audit import PaginatedAuditResponse
from app.repositories import audit as audit_repo

router = APIRouter()

@router.get("/", response_model=PaginatedAuditResponse)
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить записи журнала аудита с пагинацией.
    Доступно только администраторам.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для просмотра журналов аудита"
        )
    
    logs_data = await audit_repo.get_audit_logs(db, limit, offset)
    return logs_data
