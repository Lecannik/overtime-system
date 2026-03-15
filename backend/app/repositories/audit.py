from sqlalchemy import select
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
    """Получает список логов аудита с инфо о пользователях."""
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
    return result.all()