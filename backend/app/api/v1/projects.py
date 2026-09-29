from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_session
from app.models.user import User
from app.repositories import organization as org_repo
from app.schemas.organization import ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    """
    Получить список активных проектов.
    Доступно любому авторизованному пользователю при создании заявок.
    """
    return await org_repo.get_projects(session, only_active=True)
