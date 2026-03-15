from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.models.notification import Notification

async def create_notification(
    session: AsyncSession, 
    user_id: int, 
    title: str, 
    message: str
) -> Notification:
    notif = Notification(user_id=user_id, title=title, message=message)
    session.add(notif)
    await session.commit()
    await session.refresh(notif)
    return notif

async def get_user_notifications(
    session: AsyncSession, 
    user_id: int, 
    limit: int = 20
) -> List[Notification]:
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(query)
    return result.scalars().all()

async def mark_as_read(session: AsyncSession, notification_id: int, user_id: int):
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.user_id == user_id)
        .values(is_read=True)
    )
    await session.commit()

async def mark_all_as_read(session: AsyncSession, user_id: int):
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user_id)
        .values(is_read=True)
    )
    await session.commit()
