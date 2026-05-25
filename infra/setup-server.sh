#!/bin/bash
# =======================================================
# Скрипт первоначальной настройки продакшн-сервера
# =======================================================
# Запуск от root: bash setup-server.sh
#
# Что делает:
#   1. Обновляет систему
#   2. Устанавливает Docker и Docker Compose
#   3. Создаёт рабочую директорию /opt/overtime
#   4. Настраивает файрвол (UFW)
# =======================================================

set -euo pipefail

echo "========================================"
echo "🔧 Настройка сервера для OvertimePro"
echo "========================================"

# 1. Обновление системы
echo "📦 Обновление системы..."
apt-get update && apt-get upgrade -y

# 2. Установка базовых утилит
echo "🛠 Установка утилит..."
apt-get install -y \
    curl \
    wget \
    git \
    htop \
    ufw \
    fail2ban \
    unzip

# 3. Установка Docker
echo "🐳 Установка Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker установлен: $(docker --version)"
else
    echo "✅ Docker уже установлен: $(docker --version)"
fi

# 4. Создание рабочей директории
echo "📁 Создание директории приложения..."
mkdir -p /opt/overtime/backups

# 5. Настройка файрвола
echo "🔥 Настройка файрвола (UFW)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (для будущего SSL)
echo "y" | ufw enable
ufw status

# 6. Настройка fail2ban для защиты SSH
echo "🛡 Настройка fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

echo ""
echo "========================================"
echo "✅ Сервер готов к деплою!"
echo "========================================"
echo ""
echo "Следующие шаги:"
echo "  1. Скопируйте файлы на сервер:"
echo "     scp docker-compose.prod.yml root@92.46.127.98:/opt/overtime/docker-compose.yml"
echo "     scp .env root@92.46.127.98:/opt/overtime/.env"
echo "     scp infra/gateway/nginx.conf root@92.46.127.98:/opt/overtime/nginx.conf"
echo "     scp infra/deploy.sh root@92.46.127.98:/opt/overtime/deploy.sh"
echo ""
echo "  2. На сервере запустите:"
echo "     cd /opt/overtime && bash deploy.sh"
echo ""
echo "  3. Создайте администратора:"
echo "     docker exec overtime_backend python scripts/create_admin.py"
echo ""
