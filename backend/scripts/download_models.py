import os
import logging
import whisper
from transformers import T5ForConditionalGeneration, T5Tokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_models():
    # 1. Загрузка модели Whisper "base"
    logger.info("🎬 Скачивание модели Whisper 'base'...")
    # Указываем путь к кэшу явно
    cache_dir = os.environ.get("XDG_CACHE_HOME", "/app/.cache")
    whisper_cache = os.path.join(cache_dir, "whisper")
    os.makedirs(whisper_cache, exist_ok=True)
    
    # whisper.load_model скачивает модель и сохраняет её в кэш
    model = whisper.load_model("base", download_root=whisper_cache)
    logger.info(f"✅ Whisper успешно скачан и сохранен в {whisper_cache}")

    # 2. Загрузка модели RuT5 Gazeta
    model_name = "IlyaGusev/rut5_base_sum_gazeta"
    target_dir = "/app/models/gazeta_default"
    logger.info(f"🎬 Скачивание суммаризатора {model_name}...")
    os.makedirs(target_dir, exist_ok=True)
    
    tokenizer = T5Tokenizer.from_pretrained(model_name)
    model = T5ForConditionalGeneration.from_pretrained(model_name)
    
    tokenizer.save_pretrained(target_dir)
    model.save_pretrained(target_dir)
    logger.info(f"✅ Модель суммаризатора сохранена в {target_dir}")

if __name__ == "__main__":
    download_models()
