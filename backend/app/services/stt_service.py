"""
STT (Speech-to-Text) сервис.

ВАЖНО: torch, whisper и transformers импортируются ЛЕНИВО — только при первом вызове.
Это критично, потому что их загрузка занимает 30+ секунд и блокирует startup Uvicorn.
"""
import os
import logging

logger = logging.getLogger(__name__)

# Модели (ленивая инициализация)
_whisper_model = None
_summary_model = None
_summary_tokenizer = None
_torch = None


def _get_torch():
    """Ленивый импорт PyTorch — только при первом вызове."""
    global _torch
    if _torch is None:
        import torch
        # Ограничиваем потоки для инференса, чтобы не грузить систему
        torch.set_num_threads(2)
        _torch = torch
    return _torch


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        torch = _get_torch()
        logger.info("🎬 Загрузка Whisper (tiny)...")
        _whisper_model = whisper.load_model("tiny")
        _whisper_model.eval()
    return _whisper_model


def get_summarizer():
    global _summary_model, _summary_tokenizer
    if _summary_model is None:
        from transformers import T5ForConditionalGeneration, T5Tokenizer
        torch = _get_torch()

        model_path = "/app/models/gazeta"
        if not os.path.exists(model_path):
            model_path = "models/gazeta"

        logger.info(f"🎬 Загрузка Суммаризатора из {model_path}...")
        _summary_tokenizer = T5Tokenizer.from_pretrained(model_path)
        _summary_model = T5ForConditionalGeneration.from_pretrained(model_path)
        _summary_model.eval()

        if torch.cuda.is_available():
            _summary_model = _summary_model.to("cuda")

    return _summary_model, _summary_tokenizer


async def summarize_text(text: str) -> str:
    """Генерирует резюме с помощью T5."""
    if not text:
        return "[Нет текста]"

    # Короткие тексты не суммаризируем — T5 на них галлюцинирует
    if len(text) < 100:
        cleaned = text.strip()
        if cleaned:
            return cleaned[0].upper() + cleaned[1:]
        return cleaned

    try:
        torch = _get_torch()
        model, tokenizer = get_summarizer()

        with torch.no_grad():
            inputs = tokenizer([text], max_length=1024, truncation=True, return_tensors="pt")
            output_ids = model.generate(
                input_ids=inputs["input_ids"],
                max_length=80,
                min_length=10,
                num_beams=4,
                repetition_penalty=2.5,
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
        torch = _get_torch()
        w_model = get_whisper()

        with torch.no_grad():
            result = w_model.transcribe(file_path, language="ru")
        raw_text = result["text"].strip()

        summary = await summarize_text(raw_text)

        return {
            "text": raw_text,
            "summary": summary
        }
    except Exception as e:
        logger.error(f"❌ Ошибка STT: {str(e)}")
        return {"text": f"[Ошибка: {str(e)}]", "summary": "[Ошибка]"}
    finally:
        import gc
        gc.collect()
        torch = _get_torch()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
