import logging
from app.models.user import User
from app.services.telegram import send_telegram_message
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

async def notify_new_task(session: AsyncSession, task: any, assigned_user: User, creator: User):
    """Уведомляет обе стороны о новой задаче."""
    msg_html = (
        f"📝 <b>Новая задача!</b>\n\n"
        f"📌 <b>Название</b>: {task.title}\n"
        f"👤 <b>Создатель</b>: {creator.full_name}\n"
        f"📊 <b>Приоритет</b>: {task.priority}\n"
        f"📅 <b>Дедлайн</b>: {task.deadline.strftime('%d.%m.%Y') if task.deadline else '—'}\n"
    )
    
    # Исполнителю
    if assigned_user.telegram_chat_id:
        await send_telegram_message(session, assigned_user.telegram_chat_id, msg_html + "\nВы назначены исполнителем. 💪")
    
    # Создателю
    if creator.telegram_chat_id and creator.id != assigned_user.id:
        await send_telegram_message(session, creator.telegram_chat_id, msg_html + "\nЗадача успешно создана и назначена. ✅")


async def notify_task_status_change(session: AsyncSession, task: any, old_status: str, new_status: str):
    """Уведомляет при изменении статуса задачи."""
    # Получаем участников
    from sqlalchemy import select
    res = await session.execute(select(User).where(User.id.in_([task.creator_id, task.assigned_id])))
    users = {u.id: u for u in res.scalars().all()}
    
    creator = users.get(task.creator_id)
    assigned = users.get(task.assigned_id)
    
    msg_html = (
        f"🔄 <b>Статус задачи изменен</b>\n\n"
        f"📌 <b>Задача</b>: {task.title}\n"
        f"📉 <b>Было</b>: {old_status}\n"
        f"📈 <b>Стало</b>: <b>{new_status}</b>\n"
    )

    # Уведомляем создателя
    if creator and creator.telegram_chat_id:
        await send_telegram_message(session, creator.telegram_chat_id, msg_html)
        
    # Уведомляем исполнителя (если это не он сменил статус, но обычно он и меняет)
    if assigned and assigned.telegram_chat_id and assigned.id != creator.id:
        await send_telegram_message(session, assigned.telegram_chat_id, msg_html)


async def notify_task_review(session: AsyncSession, task: any, manager: User):
    """Уведомляет менеджера о необходимости проверки."""
    if not manager.telegram_chat_id:
        return

    msg_html = (
        f"👀 <b>Задача требует проверки</b>\n\n"
        f"📌 <b>Название</b>: {task.title}\n"
        f"📂 <b>Проект</b>: {task.project_id}\n\n"
        f"Пожалуйста, проверьте выполнение. 🔍"
    )
    await send_telegram_message(session, manager.telegram_chat_id, msg_html)


async def notify_limit_exceeded(session: AsyncSession, overtime: any, manager: User, weekly_hours: float, limit: float):
    """Уведомляет о превышении лимита переработок."""
    if not manager or not manager.telegram_chat_id:
        return
        
    msg_html = (
        f"⚠️ <b>Превышение лимита!</b>\n\n"
        f"👤 <b>Сотрудник</b>: {overtime.user.full_name}\n"
        f"📂 <b>Проект</b>: {overtime.project.name}\n"
        f"📊 <b>Часов за неделю</b>: {weekly_hours:.1f}\n"
        f"🚫 <b>Лимит проекта</b>: {limit:.1f}\n\n"
        f"Заявка создана, но требует внимательной проверки. 🧐"
    )
    await send_telegram_message(session, manager.telegram_chat_id, msg_html)


async def notify_new_overtime(session: AsyncSession, overtime: any, manager: User, head: User):
    """Уведомляет руководителей о новой заявке."""
    msg_html = (
        f"➕ <b>Новая заявка на переработку</b>\n\n"
        f"👤 <b>Сотрудник</b>: {overtime.user.full_name}\n"
        f"📂 <b>Проект</b>: {overtime.project.name}\n"
        f"⏰ <b>Время</b>: {overtime.start_time.strftime('%H:%M')} - {overtime.end_time.strftime('%H:%M')}\n"
        f"⏱ <b>Часов</b>: {overtime.hours:.1f}\n"
        f"📝 <b>Описание</b>: {overtime.description}\n"
    )
    
    # Менеджеру
    if manager and manager.telegram_chat_id:
        await send_telegram_message(session, manager.telegram_chat_id, msg_html + "\nОжидается ваше согласование. ⏳")
        
    # Начальнику
    if head and head.telegram_chat_id:
        await send_telegram_message(session, head.telegram_chat_id, msg_html + "\nОжидается ваше согласование. ⏳")


async def notify_overtime_review(session: AsyncSession, overtime: any, reviewer: User):
    """Уведомляет сотрудника о решении по его заявке."""
    status_label = "одобрена" if overtime.status == "APPROVED" else "отклонена"
    status_emoji = "✅" if overtime.status == "APPROVED" else "❌"
    
    if overtime.status == "MANAGER_APPROVED":
        status_label = "одобрена менеджером"
        status_emoji = "🟧"
    elif overtime.status == "HEAD_APPROVED":
        status_label = "одобрена нач. отдела"
        status_emoji = "🟨"

    msg_html = (
        f"{status_emoji} <b>Решение по заявке</b>\n\n"
        f"📅 <b>Дата</b>: {overtime.start_time.strftime('%d.%m.%Y')}\n"
        f"📂 <b>Проект</b>: {overtime.project.name}\n"
        f"📈 <b>Статус</b>: {status_label}\n"
        f"👤 <b>Кто проверил</b>: {reviewer.full_name}\n"
    )
    
    comment = overtime.manager_comment if reviewer.role == "manager" else overtime.head_comment
    if comment:
        msg_html += f"💬 <b>Комментарий</b>: {comment}\n"
        
    if overtime.user.telegram_chat_id:
        await send_telegram_message(session, overtime.user.telegram_chat_id, msg_html)
