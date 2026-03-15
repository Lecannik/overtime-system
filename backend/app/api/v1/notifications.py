from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.repositories import notification as notif_repo

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список моих уведомлений."""
    return await notif_repo.get_user_notifications(db, current_user.id)

@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Пометить уведомление как прочитанное."""
    await notif_repo.mark_as_read(db, notification_id, current_user.id)
    return {"status": "ok"}

@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Пометить все как прочитанные."""
    await notif_repo.mark_all_as_read(db, current_user.id)
    return {"status": "ok"}
