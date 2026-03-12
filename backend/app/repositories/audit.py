from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


async def create_audit_log(
    session: AsyncSession, 
    user_id: int, 
    action: str, 
    target_type: str, 
    target_id: int, 
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