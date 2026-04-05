from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User


async def create_audit_log(
    session: AsyncSession, 
    user_id: int, 
    action: str, 
    target_type: str | None = None, 
    target_id: int | None = None, 
    details: dict = None
):
    """Создает запись в журнале аудита."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    session.add(log)
    await session.flush()  # Используем flush, чтобы изменения попали в транзакцию сервиса
    return log

async def get_audit_logs(
    session: AsyncSession,
    limit: int = 100,
    offset: int = 0
):
    """Получает список логов аудита с инфо о пользователях со счетчиком total."""
    
    # 1. Считаем общее количество
    total_query = select(func.count(AuditLog.id))
    total_result = await session.execute(total_query)
    total = total_result.scalar()

    # 2. Получаем данные
    query = select(
        AuditLog.id,
        AuditLog.user_id,
        User.full_name.label("user_full_name"),
        AuditLog.action,
        AuditLog.target_type,
        AuditLog.target_id,
        AuditLog.details,
        AuditLog.created_at
    ).join(User, AuditLog.user_id == User.id)\
     .order_by(AuditLog.created_at.desc())\
     .limit(limit)\
     .offset(offset)
    
    result = await session.execute(query)
    
    # Формируем список словарей для фронта
    items = []
    for row in result.all():
        items.append({
            "id": row.id,
            "user_id": row.user_id,
            "user": {"full_name": row.user_full_name},
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "details": row.details,
            "timestamp": row.created_at
        })

    return {"items": items, "total": total}