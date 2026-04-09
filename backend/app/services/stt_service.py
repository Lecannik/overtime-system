import whisper
import os
import logging
import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer

logger = logging.getLogger(__name__)

# Модели
_whisper_model = None
_summary_model = None
_summary_tokenizer = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        logger.info("🎬 Загрузка Whisper (ASR)...")
        _whisper_model = whisper.load_model("base")
    return _whisper_model

def get_summarizer():
    global _summary_model, _summary_tokenizer
    if _summary_model is None:
        model_path = "/app/models/gazeta" # Путь внутри докера
        if not os.path.exists(model_path):
             # Пытаемся найти локально если не в докере
             model_path = "models/gazeta"
             
        logger.info(f"🎬 Загрузка Суммаризатора из {model_path}...")
        _summary_tokenizer = T5Tokenizer.from_pretrained(model_path)
        _summary_model = T5ForConditionalGeneration.from_pretrained(model_path)
    return _summary_model, _summary_tokenizer

async def summarize_text(text: str) -> str:
    """Генерирует профессиональное резюме с помощью T5."""
    if not text:
        return "[Нет текста]"

    # Если текст короткий (меньше 100 символов), суммаризация не нужна.
    # Т5 на коротких текстах часто галлюцинирует.
    if len(text) < 100:
        cleaned = text.strip()
        if cleaned:
            return cleaned[0].upper() + cleaned[1:]
        return cleaned

    try:
        model, tokenizer = get_summarizer()
        inputs = tokenizer([text], max_length=1024, truncation=True, return_tensors="pt")
        
        # Генерация с улучшенными параметрами для предотвращения бреда
        output_ids = model.generate(
            input_ids=inputs["input_ids"],
            max_length=80,
            min_length=10,
            num_beams=4,
            repetition_penalty=2.5,  # Штраф за повторы
            no_repeat_ngram_size=3,
            early_stopping=True
        )
        
        summary = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        
        if summary:
            summary = summary[0].upper() + summary[1:]
        
        return summary
    except Exception as e:
        logger.error(f"❌ Ошибка суммаризации: {str(e)}")
        return text[:50] + "..."

async def transcribe_audio(file_path: str) -> dict:
    """ASR + NLP Summary."""
    if not os.path.exists(file_path):
        return {"text": "[Ошибка]", "summary": "[Ошибка]"}

    try:
        # 1. Голос -> Текст
        w_model = get_whisper()
        result = w_model.transcribe(file_path, language="ru")
        raw_text = result["text"].strip()
        
        # 2. Текст -> Резюме + Исправление ошибок (автоматически при суммаризации)
        summary = await summarize_text(raw_text)
        
        return {
            "text": raw_text,
            "summary": summary
        }
    except Exception as e:
        logger.error(f"❌ Ошибка STT: {str(e)}")
        return {"text": f"[Ошибка: {str(e)}]", "summary": "[Ошибка]"}
