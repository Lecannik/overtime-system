FROM python:3.11-slim
WORKDIR /app

# Системные зависимости для Whisper, аудио и БД
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libpq-dev \
    zlib1g-dev \
    libjpeg-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Чтобы Alembic видел папку app как модуль
ENV PYTHONPATH=/app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Копируем само приложение
COPY ./app ./app

# Alembic
COPY alembic.ini .
COPY ./alembic ./alembic

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]