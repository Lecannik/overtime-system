from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_get, cache_set
from app.core.database import get_session
from app.models.user import User
from app.repositories import organization as org_repo
from app.schemas.organization import DepartmentResponse

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=List[DepartmentResponse])
@router.get("/", response_model=List[DepartmentResponse], include_in_schema=False)
async def list_departments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[DepartmentResponse]:
    """
    Получить список всех отделов компании.

    Эндпоинт доступен любому авторизованному пользователю для фильтрации данных
    и выбора отдела. Результат кэшируется в оперативной памяти на 5 минут (TTL 300 сек).

    :param session: Асинхронная сессия базы данных SQLAlchemy.
    :param current_user: Текущий авторизованный пользователь системы.
    :return: Список объектов отделов (DepartmentResponse).
    """
    hit, cached = cache_get("departments")
    if hit:
        return cached

    departments = await org_repo.get_departments(session)
    serialized = [DepartmentResponse.model_validate(d) for d in departments]
    cache_set("departments", serialized, ttl=300)
    return serialized
