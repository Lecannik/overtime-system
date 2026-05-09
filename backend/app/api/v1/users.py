from typing import List, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/list", response_model=List[Any])
async def list_users_public(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Публичный список пользователей (для выпадающих списков и т.д.).
    Доступен всем авторизованным пользователям.
    Возвращает ограниченный набор данных.
    """
    result = await db.execute(
        select(User)
        .where(User.is_active == True)
        .order_by(User.full_name)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": u.id, 
            "full_name": u.full_name, 
            "department_id": u.department_id,
            "role": u.role_name
        } for u in users
    ]
