from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse
from app.repositories import audit as audit_repo

router = APIRouter()

@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить записи журнала аудита.
    Доступно только администраторам.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для просмотра журналов аудита"
        )
    
    logs = await audit_repo.get_audit_logs(db, limit, offset)
    return logs
