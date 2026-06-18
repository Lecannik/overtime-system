# =============================================================================
# Production Dockerfile.
#
# Наследует lecannik/overtime-base:latest — образ с предустановленными
# тяжёлыми ML-зависимостями (torch, whisper, transformers и т.д.).
# Базовый образ собирается ВРУЧНУЮ через Dockerfile.base при изменении
# зависимостей и НЕ входит в автоматический CI/CD пайплайн.
#
# Благодаря этому обычный деплой (изменение кода) занимает ~1-2 минуты
# вместо 20-30 минут.
# =============================================================================

FROM lecannik/overtime-base:latest

WORKDIR /app

# Чтобы Alembic видел папку app как модуль
ENV PYTHONPATH=/app
# Перенаправляем кэш Whisper в /app/.cache (вместо /root)
ENV XDG_CACHE_HOME=/app/.cache

# Копируем код приложения и скрипты
COPY ./app ./app
COPY alembic.ini .
COPY ./alembic ./alembic
COPY ./scripts ./scripts

# Подготавливаем директории и права.
# ML-модели скачиваются при ПЕРВОМ СТАРТЕ контейнера через entrypoint.sh
# и кэшируются в Docker volume — повторного скачивания нет.
RUN mkdir -p /app/uploads /app/.cache /app/models && \
    chmod +x /app/scripts/entrypoint.sh && \
    chown -R appuser:appgroup /app

USER appuser

CMD ["/app/scripts/entrypoint.sh"]