import os
import time
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

# Папка с аудиозаписями
VOICE_DIR = "uploads/voice"
# Срок хранения по умолчанию (в днях)
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "90"))

def cleanup_old_voices():
    """Сканирует папку и удаляет файлы старше RETENTION_DAYS."""
    logger.info(f"🧹 Запуск автоматической очистки голосов (Срок: {RETENTION_DAYS} дней)...")
    
    if not os.path.exists(VOICE_DIR):
        logger.warning(f"⚠️ Папка {VOICE_DIR} не найдена. Очистка отменена.")
        return

    now = time.time()
    cutoff = now - (RETENTION_DAYS * 86400) # Секунды в днях
    
    deleted_count = 0
    freed_space = 0 # В байтах

    try:
        for filename in os.listdir(VOICE_DIR):
            file_path = os.path.join(VOICE_DIR, filename)
            
            # Проверяем только файлы (не папки)
            if os.path.isfile(file_path):
                file_mtime = os.path.getmtime(file_path)
                
                if file_mtime < cutoff:
                    size = os.path.getsize(file_path)
                    os.remove(file_path)
                    deleted_count += 1
                    freed_space += size
                    logger.debug(f"🗑️ Удален старый голос: {filename}")

        if deleted_count > 0:
            mb_freed = round(freed_space / (1024 * 1024), 2)
            logger.info(f"✅ Очистка завершена! Удалено файлов: {deleted_count}. Освобождено: {mb_freed} МБ.")
        else:
            logger.info("🌤️ Старых аудиозаписей не найдено. Папка в порядке.")
            
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при очистке: {str(e)}")

def setup_cleanup_scheduler():
    """Настройка фонового выполнения очистки."""
    scheduler = AsyncIOScheduler()
    # Запускаем каждую полночь (00:00)
    scheduler.add_job(cleanup_old_voices, 'cron', hour=0, minute=0)
    
    # Также запустим один раз СРАЗУ при старте сервера для проверки
    scheduler.add_job(cleanup_old_voices, 'date', run_date=datetime.now() + timedelta(seconds=10))
    
    scheduler.start()
    logger.info("📅 Планировщик очистки запущен (00:00 ежедневно).")
    return scheduler
