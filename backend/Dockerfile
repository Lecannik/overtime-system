FROM python:3.11-slim
WORKDIR /app

# Системные зависимости для Whisper и аудио
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Чтобы Alembic видел папку app как модуль
ENV PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Копируем само приложение
COPY ./app ./app

# Alembic
COPY alembic.ini .
COPY ./alembic ./alembic

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]