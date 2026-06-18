#!/bin/sh
# =============================================================================
# Entrypoint контейнера бэкенда.
#
# Логика:
# 1. Если ML-модели ещё не скачаны (нет файла-маркера), запускаем
#    download_models.py. Модели хранятся в volume /app/models и /app/.cache,
#    поэтому при следующих перезапусках этот шаг пропускается.
# 2. Применяем Alembic-миграции.
# 3. Запускаем uvicorn.
# =============================================================================

set -e

MODELS_MARKER="/app/models/.models_ready"

if [ ! -f "$MODELS_MARKER" ]; then
    echo "📦 ML-модели не найдены, запускаем скачивание..."
    python scripts/download_models.py
    touch "$MODELS_MARKER"
    echo "✅ Модели скачаны и кэшированы."
else
    echo "✅ ML-модели уже присутствуют, пропускаем скачивание."
fi

echo "⚙️  Применяем миграции базы данных..."
alembic upgrade head

echo "🚀 Запускаем uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
