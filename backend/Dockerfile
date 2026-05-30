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
    pip install --no-cache-dir --prefer-binary -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# Копируем само приложение
COPY ./app ./app

# Alembic
COPY alembic.ini .
COPY ./alembic ./alembic

# Скрипты администрирования (create_admin и др.)
COPY ./scripts ./scripts

# Подготавливаем директории для данных и устанавливаем права
RUN mkdir -p /app/uploads /app/.cache && \
    chown -R appuser:appgroup /app

USER appuser

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]