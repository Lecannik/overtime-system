FROM python:3.11-slim
WORKDIR /app

# Системные зависимости для Whisper и аудио
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Создаём непривилегированного пользователя
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser

# Чтобы Alembic видел папку app как модуль
ENV PYTHONPATH=/app
# Перенаправляем кэш Whisper в /app/.cache (вместо /root)
ENV XDG_CACHE_HOME=/app/.cache

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Копируем само приложение и скрипты
COPY ./app ./app
COPY alembic.ini .
COPY ./alembic ./alembic
COPY ./scripts ./scripts

# Подготавливаем директории и права.
# ML-модели скачиваются при ПЕРВОМ СТАРТЕ контейнера через entrypoint.sh
# и кэшируются в Docker volume — поэтому скачивание в слое образа убрано.
RUN mkdir -p /app/uploads /app/.cache /app/models && \
    chmod +x /app/scripts/entrypoint.sh && \
    chown -R appuser:appgroup /app

USER appuser

CMD ["/app/scripts/entrypoint.sh"]