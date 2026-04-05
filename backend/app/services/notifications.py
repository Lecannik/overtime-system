import logging
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User
from app.services.telegram import send_telegram_message
from app.services.ms_graph import ms_graph
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories import notification as notif_repo

logger = logging.getLogger(__name__)

async def notify_new_overtime(
    session: AsyncSession,
    overtime: Overtime,
    manager: User = None,
    head: User = None
):
    """Уведомляет менеджера и нач. отдела о новой заявке."""
    msg_plain = (
        f"Новая заявка #{overtime.id}\n"
        f"От: {overtime.user.full_name}\n"
        f"Проект: {overtime.project.name}\n"
        f"Часы: {overtime.hours}\n"
        f"Требуется решение"
    )
    
    msg_html = (
        f"🔔 <b>Новая заявка #{overtime.id}</b>\n"
        f"От: {overtime.user.full_name}\n"
        f"Проект: {overtime.project.name}\n"
        f"Часы: {overtime.hours}\n"
        f"Требуется решение"
    )

    # Отправляем менеджеру
    if manager:
        await notif_repo.create_notification(session, manager.id, "Новая заявка", msg_plain)
        if manager.telegram_chat_id and manager.notification_level > 0:
            await send_telegram_message(session, manager.telegram_chat_id, msg_html)

    # Отправляем нач. отдела
    if head:
        await notif_repo.create_notification(session, head.id, "Новая заявка", msg_plain)
        if head.telegram_chat_id and head.notification_level > 0:
            await send_telegram_message(session, head.telegram_chat_id, msg_html)


async def notify_overtime_review(session: AsyncSession, overtime: Overtime, reviewer: User):
    """Уведомляет сотрудника о результате проверки (in-app + Telegram + Email)."""
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
    
    is_final = overtime.status in [OvertimeStatus.APPROVED, OvertimeStatus.REJECTED]
    should_notify_tg = False

    if employee.notification_level == 2:
        should_notify_tg = True
    elif employee.notification_level == 1 and is_final:
        should_notify_tg = True

    comment = overtime.head_comment if overtime.head_comment else overtime.manager_comment
    comment_block = f"\n💬 <b>Коммент</b>: {comment}" if comment else ""
    comment_plain = f"\nКомментарий: {comment}" if comment else ""
    
    time_str = f"{overtime.start_time.strftime('%d.%m %H:%M')} — {overtime.end_time.strftime('%H:%M')}"

    msg_plain = (
        f"Обновление заявки #{overtime.id}\n"
        f"Статус: {status_text}\n"
        f"Проект: {overtime.project.name}\n"
        f"Время: {time_str}"
        f"{comment_plain}"
    )

    # 1. In-app — всегда
    await notif_repo.create_notification(session, employee.id, status_text, msg_plain)

    # 2. Telegram — с фильтром по уровню
    if employee.telegram_chat_id and should_notify_tg:
        msg_html = (
            f"📢 <b>Обновление заявки #{overtime.id}</b>\n\n"
            f"📁 <b>Проект</b>: {overtime.project.name}\n"
            f"⏰ <b>Время</b>: {time_str} (<b>{overtime.hours}ч</b>)\n"
            f"📈 <b>Статус</b>: {status_text}\n"
            f"👤 <b>Проверил</b>: {reviewer.full_name}"
            f"{comment_block}"
        )
        await send_telegram_message(session, employee.telegram_chat_id, msg_html)

    # 3. Email — только при финальном решении (APPROVED / REJECTED)
    if is_final:
        await _send_review_email(overtime, employee, reviewer, status_text, comment, time_str)


async def _send_review_email(
    overtime: Overtime,
    employee: User,
    reviewer: User,
    status_text: str,
    comment: str | None,
    time_str: str
):
    """Отправляет стилизованное email-уведомление о решении по заявке."""
    is_approved = overtime.status == OvertimeStatus.APPROVED

    # Цвета и иконки в зависимости от решения
    accent_color = "#15803d" if is_approved else "#dc2626"
    status_label = "ОДОБРЕНА" if is_approved else "ОТКЛОНЕНА"
    status_emoji = "✅" if is_approved else "❌"

    hours_block = ""
    if is_approved and overtime.approved_hours:
        hours_block = f"""
        <tr>
            <td style="padding: 8px 16px; color: #64748b;">Согласовано часов</td>
            <td style="padding: 8px 16px; font-weight: bold; color: {accent_color};">{overtime.approved_hours}ч</td>
        </tr>
        """

    comment_block = ""
    if comment:
        comment_block = f"""
        <div style="margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid {accent_color}; border-radius: 0 8px 8px 0;">
            <strong style="color: #334155;">Комментарий:</strong>
            <p style="margin: 4px 0 0; color: #475569;">{comment}</p>
        </div>
        """

    body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 2rem;">{status_emoji}</span>
            <h2 style="margin: 8px 0 4px; color: {accent_color};">Заявка #{overtime.id} — {status_label}</h2>
            <p style="color: #94a3b8; margin: 0;">Overtime Pro</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
            <tr>
                <td style="padding: 8px 16px; color: #64748b;">Проект</td>
                <td style="padding: 8px 16px; font-weight: bold;">{overtime.project.name}</td>
            </tr>
            <tr>
                <td style="padding: 8px 16px; color: #64748b;">Время</td>
                <td style="padding: 8px 16px;">{time_str}</td>
            </tr>
            <tr>
                <td style="padding: 8px 16px; color: #64748b;">Запрошено</td>
                <td style="padding: 8px 16px;">{overtime.hours}ч</td>
            </tr>
            {hours_block}
            <tr>
                <td style="padding: 8px 16px; color: #64748b;">Решение принял</td>
                <td style="padding: 8px 16px;">{reviewer.full_name}</td>
            </tr>
        </table>

        {comment_block}

        <p style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 0.85rem;">
            Это автоматическое уведомление от системы Overtime Pro.
        </p>
    </div>
    """

    subject = f"{status_emoji} Заявка #{overtime.id} — {status_label}"

    try:
        await ms_graph.send_email(
            recipient=employee.email,
            subject=subject,
            body_content=body
        )
        logger.info(f"Email sent to {employee.email} for overtime #{overtime.id} ({status_label})")
    except Exception as e:
        # Email не должен ломать основной флоу — логируем и идём дальше
        logger.error(f"Failed to send email to {employee.email}: {e}")
async def notify_limit_exceeded(
    session: AsyncSession,
    overtime: Overtime,
    manager: User,
    current_hours: float,
    limit: int
):
    """Уведомляет менеджера о превышении лимита часов за неделю."""
    msg_plain = (
        f"⚠️ ПРЕВЫШЕНИЕ ЛИМИТА\n"
        f"Сотрудник: {overtime.user.full_name}\n"
        f"Проект: {overtime.project.name}\n"
        f"Часов за неделю: {current_hours} из {limit}\n"
        f"Заявка #{overtime.id} создана с превышением."
    )
    
    msg_html = (
        f"⚠️ <b>ПРЕВЫШЕНИЕ ЛИМИТА</b>\n\n"
        f"👤 <b>Сотрудник</b>: {overtime.user.full_name}\n"
        f"📁 <b>Проект</b>: {overtime.project.name}\n"
        f"⏳ <b>Недельная норма</b>: {limit}ч\n"
        f"📉 <b>Факт (с учетом новой)</b>: <b>{current_hours}ч</b>\n\n"
        f"Заявка #{overtime.id} требует особого внимания."
    )

    if manager:
        await notif_repo.create_notification(session, manager.id, "Превышение лимита", msg_plain)
        if manager.telegram_chat_id and manager.notification_level > 0:
            await send_telegram_message(session, manager.telegram_chat_id, msg_html)
