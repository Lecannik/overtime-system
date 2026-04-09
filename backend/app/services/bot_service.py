import logging
from datetime import datetime
import os
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
    ConversationHandler,
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.repositories import user as user_repo
from app.repositories import organization as org_repo
from app.repositories import overtime as overtime_repo
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User
from app.services.stt_service import transcribe_audio

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Состояния для ConversationHandler
CHOOSING_PROJECT, SENDING_LOCATION, SENDING_END_LOCATION, SENDING_COMMENT = range(4)

def start_markup():
    return ReplyKeyboardMarkup([
        [KeyboardButton("🚀 Начать переработку")],
        [KeyboardButton("📊 Получить отчет"), KeyboardButton("❓ Статус сессии")]
    ], resize_keyboard=True)

async def verify_user(update: Update) -> User | None:
    chat_id = update.effective_chat.id
    async with AsyncSessionLocal() as session:
        user = await user_repo.get_user_by_chat_id(session, str(chat_id))
        return user

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await verify_user(update)
    if not user: return ConversationHandler.END
    await update.message.reply_text(f"Привет, {user.full_name}! 👋", reply_markup=start_markup())
    return ConversationHandler.END

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await verify_user(update)
    if not user: return
    async with AsyncSessionLocal() as session:
        active = await overtime_repo.get_active_session(session, user.id)
        if active:
            await update.message.reply_text(
                f"👷‍♂️ В процессе: проект «{active.project.name}»\nНачало: {active.start_time.strftime('%H:%M:%S')}",
                reply_markup=ReplyKeyboardMarkup([[KeyboardButton("⏹ Остановить переработку")]], resize_keyboard=True)
            )
        else:
            await update.message.reply_text("У вас нет активных переработок.", reply_markup=start_markup())

async def start_overtime_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await verify_user(update)
    if not user: return ConversationHandler.END
    async with AsyncSessionLocal() as session:
        projects = await org_repo.get_projects(session)
        keyboard = [[InlineKeyboardButton(p.name, callback_data=f"proj_{p.id}")] for p in projects]
        await update.message.reply_text("Выберите проект:", reply_markup=InlineKeyboardMarkup(keyboard))
    return CHOOSING_PROJECT

async def project_choice_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data['project_id'] = int(query.data.split('_')[1])
    await query.delete_message()
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text="📍 Отправьте вашу текущую геопозицию (СТАРТ):",
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("📍 Отправить местоположение (СТАРТ)", request_location=True)], [KeyboardButton("❌ Отмена")]], resize_keyboard=True)
    )
    return SENDING_LOCATION

async def start_location_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Сохраняем начальную точку."""
    user = await verify_user(update)
    location = update.message.location
    project_id = context.user_data.get('project_id')
    async with AsyncSessionLocal() as session:
        new_ot = Overtime(
            user_id=user.id, project_id=project_id, start_time=datetime.now(),
            start_lat=location.latitude, start_lng=location.longitude,
            status=OvertimeStatus.IN_PROGRESS, description="[Бот]"
        )
        await overtime_repo.create_overtime(session, new_ot)
        await update.message.reply_text("✅ Работа начата!", reply_markup=ReplyKeyboardMarkup([[KeyboardButton("⏹ Остановить переработку")]], resize_keyboard=True))
    return ConversationHandler.END

async def stop_overtime_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Запрос геопозиции при ЗАВЕРШЕНИИ."""
    user = await verify_user(update)
    async with AsyncSessionLocal() as session:
        active = await overtime_repo.get_active_session(session, user.id)
        if not active:
            await update.message.reply_text("Нет активной сессии.", reply_markup=start_markup())
            return ConversationHandler.END
        context.user_data['active_id'] = active.id
        await update.message.reply_text(
            "⏹ Завершение работы. Пожалуйста, отправьте геопозицию (ФИНИШ):",
            reply_markup=ReplyKeyboardMarkup([[KeyboardButton("📍 Отправить местоположение (ФИНИШ)", request_location=True)], [KeyboardButton("❌ Отмена")]], resize_keyboard=True)
        )
    return SENDING_END_LOCATION

async def end_location_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Сохраняем конечную точку и переходим к комментарию."""
    location = update.message.location
    context.user_data['end_lat'] = location.latitude
    context.user_data['end_lng'] = location.longitude
    
    await update.message.reply_text("🗣 Теперь отправьте описание выполненных работ (текст или голос):")
    return SENDING_COMMENT

async def comment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Финальный шаг: комментарий + сохранение всех данных."""
    user = await verify_user(update)
    active_id = context.user_data.get('active_id')
    end_lat = context.user_data.get('end_lat')
    end_lng = context.user_data.get('end_lng')
    
    comment_text = ""
    summary_text = ""
    voice_url = None

    if update.message.voice:
        processing_msg = await update.message.reply_text("⏳ Анализирую ваш голос, секунду...")
        try:
            voice = await update.message.voice.get_file()
            file_path = f"uploads/voice/{active_id}_{user.id}.ogg"
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            await voice.download_to_drive(file_path)
            voice_url = file_path
            stt_result = await transcribe_audio(file_path)
            comment_text = stt_result["text"]
            summary_text = stt_result["summary"]
        except Exception as e:
            comment_text = f"[Ошибка: {str(e)}]"
            summary_text = "[Ошибка]"
        await processing_msg.delete()
    else:
        comment_text = update.message.text or "[Текст]"
        summary_text = comment_text[:50] + "..." if len(comment_text) > 50 else comment_text

    async with AsyncSessionLocal() as session:
        active = await overtime_repo.get_overtime_by_id(session, active_id)
        if active:
            active.end_time = datetime.now()
            active.description = comment_text
            active.status = OvertimeStatus.PENDING
            active.voice_url = f"/{voice_url}" if voice_url and not voice_url.startswith("/") else voice_url
            active.voice_summary = summary_text if summary_text else None
            # Сохраняем конечные координаты
            active.end_lat = end_lat
            active.end_lng = end_lng
            await session.commit()
            
            duration = active.end_time - active.start_time
            dur_str = f"{duration.seconds // 3600}ч {(duration.seconds // 60) % 60}м"
            
            report = (
                "📊 **ОТЧЕТ ПО ПЕРЕРАБОТКЕ**\n"
                "━━━━━━━━━━━━━━━\n"
                f"🎯 **Суть:** {summary_text}\n"
                f"📍 **Проект:** {active.project.name}\n"
                f"🏁 **Финиш:** Зафиксирован\n"
                f"⏳ **Время:** {dur_str}\n\n"
                "📝 **Полный текст:**\n"
                f"«{comment_text}»\n"
                "━━━━━━━━━━━━━━━"
            )
            await update.message.reply_text(report, parse_mode="Markdown", reply_markup=start_markup())
    return ConversationHandler.END

def setup_bot(token: str):
    application = Application.builder().token(token).build()
    main_handler = ConversationHandler(
        entry_points=[
            MessageHandler(filters.Regex("^🚀 Начать переработку$"), start_overtime_flow),
            MessageHandler(filters.Regex("^⏹ Остановить переработку$"), stop_overtime_flow),
        ],
        states={
            CHOOSING_PROJECT: [CallbackQueryHandler(project_choice_handler, pattern="^proj_")],
            SENDING_LOCATION: [MessageHandler(filters.LOCATION, start_location_handler)],
            SENDING_END_LOCATION: [MessageHandler(filters.LOCATION, end_location_handler)],
            SENDING_COMMENT: [MessageHandler(filters.TEXT | filters.VOICE, comment_handler)],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Отмена$"), start)],
        allow_reentry=True
    )
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.Regex("^❓ Статус сессии$"), status))
    application.add_handler(main_handler)
    return application

async def run_bot_async(token: str):
    app = setup_bot(token)
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    return app
