from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_get, cache_set
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
    Результат кэшируется в памяти на 5 минут (TTL 300 сек).
    """
    hit, cached = cache_get("projects", only_active=True)
    if hit:
        return cached

    projects = await org_repo.get_projects(session, only_active=True)
    serialized = [ProjectResponse.model_validate(p) for p in projects]
    cache_set("projects", serialized, ttl=300, only_active=True)
    return serialized
