import logging
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User
from app.services.telegram import send_telegram_message
from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger(__name__)


async def notify_new_overtime(
    session: AsyncSession,
    overtime: Overtime,
    manager: User = None,
    head: User = None
):
    """Уведомляет менеджера и нач. отдела о новой заявке."""
    msg = (
        f"🔔 <b>Новая заявка #{overtime.id}</b>\n"
        f"От: {overtime.user.full_name}\n"
        f"Проект: {overtime.project.name}\n"
        f"Часы: {overtime.hours if hasattr(overtime, 'hours') else '—'}\n"
        f"Требуется решение"
    )

    # Отправляем менеджеру, если у него включены уведомления
    if manager and manager.telegram_chat_id and manager.notification_level > 0:
        await send_telegram_message(session, manager.telegram_chat_id, msg)

    # Отправляем нач. отдела
    if head and head.telegram_chat_id and head.notification_level > 0:
        await send_telegram_message(session, head.telegram_chat_id, msg)


async def notify_overtime_review(session: AsyncSession, overtime: Overtime, reviewer: User):
    """Уведомляет сотрудника о результате проверки."""
    status_map = {
        OvertimeStatus.APPROVED: "✅ Одобрена",
        OvertimeStatus.REJECTED: "❌ Отклонена",
        OvertimeStatus.MANAGER_APPROVED: "👨‍💼 Одобрена менеджером",
        OvertimeStatus.HEAD_APPROVED: "🏫 Одобрена нач. отдела"
    }

    # Подгружаем проект и сотрудника
    await session.refresh(overtime, ["project"])
    employee = await session.get(User, overtime.user_id)
    if not employee:
        return

    status_text = status_map.get(overtime.status, str(overtime.status))
    
    # ВОТ ЭТОТ БЛОК НУЖНО ВЕРНУТЬ:
    is_final = overtime.status in [OvertimeStatus.APPROVED, OvertimeStatus.REJECTED]
    should_notify = False

    if employee.notification_level == 2:
        should_notify = True
    elif employee.notification_level == 1 and is_final:
        should_notify = True

    # Далее твоя красивая верстка сообщения...
    comment = overtime.head_comment if overtime.head_comment else overtime.manager_comment
    comment_block = f"\n💬 <b>Коммент</b>: {comment}" if comment else ""
    time_str = f"{overtime.start_time.strftime('%d.%m %H:%M')} — {overtime.end_time.strftime('%H:%M')}"

    if employee.telegram_chat_id and should_notify:
        msg = (
            f"📢 <b>Обновление заявки #{overtime.id}</b>\n\n"
            f"📁 <b>Проект</b>: {overtime.project.name}\n"
            f"⏰ <b>Время</b>: {time_str} (<b>{overtime.hours}ч</b>)\n"
            f"📝 <b>Задача</b>: {overtime.description}\n"
            f"📈 <b>Статус</b>: {status_text}\n"
            f"👤 <b>Проверил</b>: {reviewer.full_name}"
            f"{comment_block}"
        )
        await send_telegram_message(session, employee.telegram_chat_id, msg)