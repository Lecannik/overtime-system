from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.organization import ProjectResponse
from app.repositories import organization as org_repo
from app.models.organization import Project

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список активных проектов.
    Доступно любому авторизованному пользователю при создании заявок.
    """
    projects = await org_repo.get_projects(db, only_active=True)
    
    # Проверяем, есть ли среди них внутренний проект
    has_internal = any(
        "внутренн" in p.name.lower() or (p.code and p.code.upper() == "INTERNAL")
        for p in projects
    )
    
    if not has_internal:
        # Проверяем в БД (включая неактивные)
        res = await db.execute(
            select(Project).where(
                (Project.name.ilike("%внутренн%")) | (Project.code == "INTERNAL")
            )
        )
        internal_db = res.scalar_one_or_none()
        if not internal_db:
            # Создаем проект "Внутренний"
            internal_db = Project(
                name="Внутренний (Внутренние работы)",
                code="INTERNAL",
                is_active=True,
                weekly_limit=100
            )
            db.add(internal_db)
            await db.commit()
            # Заново запрашиваем список
            projects = await org_repo.get_projects(db, only_active=True)
            
    return projects
