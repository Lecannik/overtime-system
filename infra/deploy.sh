#!/bin/bash
# =======================================================
# Скрипт деплоя OvertimePro на продакшн-сервере
# =======================================================
# Расположение: /opt/overtime/deploy.sh
# Запуск: sudo bash deploy.sh
# =======================================================

set -euo pipefail

APP_DIR="/opt/overtime"
COMPOSE_FILE="docker-compose.yml"
LOG_FILE="${APP_DIR}/deploy.log"

echo "========================================" | tee -a "$LOG_FILE"
echo "🚀 Начало деплоя: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

cd "$APP_DIR"

# 1. Скачиваем последние образы
echo "📦 Скачиваем обновлённые образы из DockerHub..." | tee -a "$LOG_FILE"
docker compose -f "$COMPOSE_FILE" pull backend frontend 2>&1 | tee -a "$LOG_FILE"

# 2. Перезапускаем контейнеры с новыми образами
echo "🔄 Перезапускаем контейнеры..." | tee -a "$LOG_FILE"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# 3. Ждём, пока бэкенд запустится (health-check)
echo "⏳ Ожидаем запуск бэкенда..." | tee -a "$LOG_FILE"
for i in {1..30}; do
    if curl -sf http://localhost/api/v1/health > /dev/null 2>&1; then
        echo "✅ Бэкенд доступен!" | tee -a "$LOG_FILE"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Бэкенд не ответил за 60 секунд!" | tee -a "$LOG_FILE"
        docker compose -f "$COMPOSE_FILE" logs --tail=50 backend | tee -a "$LOG_FILE"
        exit 1
    fi
    sleep 2
done

# 4. Очистка неиспользуемых образов
echo "🧹 Очищаем старые образы..." | tee -a "$LOG_FILE"
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

echo "========================================" | tee -a "$LOG_FILE"
echo "✅ Деплой завершён: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
