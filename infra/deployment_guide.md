# 📋 Инструкция по деплою OvertimePro

## 🖥 Характеристики ВМ для Proxmox

| Параметр | Рекомендация | Минимум | Обоснование |
|----------|-------------|---------|-------------|
| **vCPU** | 4 ядра | 2 ядра | Whisper (STT) и Transformers требуют CPU |
| **RAM** | 4 ГБ | 2 ГБ | Whisper загружает модель в память (~1.5 ГБ) |
| **Диск** | 40 ГБ SSD | 20 ГБ | Docker-образы (~3 ГБ) + БД + бэкапы + логи |
| **ОС** | Ubuntu 24.04 LTS | Ubuntu 22.04 | Долгая поддержка |
| **Сеть** | Bridge с белым IP `92.46.127.98` | — | Прямой доступ извне |

> [!TIP]
> Если Whisper не критичен на первом этапе, достаточно **2 vCPU / 2 ГБ RAM / 20 ГБ SSD**.
> При активном использовании STT рекомендуется **4 vCPU / 4 ГБ RAM**.

---

## 📁 Созданные файлы

| Файл | Назначение |
|------|-----------|
| [ci.yml](file:///home/nik/Dev/overtime-prod/.github/workflows/ci.yml) | CI — тесты + линт (исправлен баг) |
| [cd.yml](file:///home/nik/Dev/overtime-prod/.github/workflows/cd.yml) | **CD — сборка и push образов на DockerHub** |
| [docker-compose.prod.yml](file:///home/nik/Dev/overtime-prod/docker-compose.prod.yml) | **Compose для продакшн-сервера** (image вместо build) |
| [.env.prod.example](file:///home/nik/Dev/overtime-prod/.env.prod.example) | **Шаблон .env для продакшна** |
| [deploy.sh](file:///home/nik/Dev/overtime-prod/infra/deploy.sh) | **Скрипт деплоя** (pull + restart + healthcheck) |
| [setup-server.sh](file:///home/nik/Dev/overtime-prod/infra/setup-server.sh) | **Первоначальная настройка сервера** |
| [Dockerfile (backend)](file:///home/nik/Dev/overtime-prod/backend/Dockerfile) | Добавлена копия `scripts/` |

---

## 🚀 Пошаговый план

### Этап 1: Настройка GitHub Secrets (5 минут)

Перейдите в **Settings → Secrets and variables → Actions** вашего репозитория:
`https://github.com/Lecannik/overtime-system/settings/secrets/actions`

Добавьте два секрета:

| Имя секрета | Значение |
|-------------|----------|
| `DOCKERHUB_USERNAME` | `lecannik` |
| `DOCKERHUB_TOKEN` | Access Token из [hub.docker.com/settings/security](https://hub.docker.com/settings/security) |

> [!IMPORTANT]
> На DockerHub нужно создать **Access Token** (не пароль аккаунта):
> Hub → Account Settings → Security → New Access Token → Read/Write

### Этап 2: Коммит и Push (5 минут)

```bash
cd /home/nik/Dev/overtime-prod

# Добавляем все изменения
git add -A

# Коммитим
git commit -m "feat: add CD pipeline, production compose and deploy scripts

- Add GitHub Actions CD workflow (build & push to DockerHub)
- Add docker-compose.prod.yml for production deployment
- Add .env.prod.example template
- Add server setup and deploy scripts
- Fix CI bug (duplicate setup-python step)
- Copy scripts/ into backend Docker image
- Multiple frontend/backend improvements"

# Пушим
git push origin main
```

После push:
1. **CI** запустится автоматически (тесты + сборка)
2. **CD** запустится и соберёт образы:
   - `lecannik/overtime-backend:latest`
   - `lecannik/overtime-frontend:latest`

### Этап 3: Создание ВМ и первый деплой

#### 3.1 Создайте ВМ в Proxmox
- Ubuntu 24.04 LTS
- 4 vCPU, 4 ГБ RAM, 40 ГБ SSD
- Сеть: Bridge → `92.46.127.98`

#### 3.2 Настройте сервер
```bash
# С вашей машины — скопируйте скрипт настройки
scp infra/setup-server.sh root@92.46.127.98:/root/

# На сервере — запустите его
ssh root@92.46.127.98
bash /root/setup-server.sh
```

#### 3.3 Скопируйте файлы деплоя
```bash
# С вашей машины
scp docker-compose.prod.yml root@92.46.127.98:/opt/overtime/docker-compose.yml
scp .env.prod.example root@92.46.127.98:/opt/overtime/.env
scp infra/gateway/nginx.conf root@92.46.127.98:/opt/overtime/nginx.conf
scp infra/deploy.sh root@92.46.127.98:/opt/overtime/deploy.sh
```

#### 3.4 Настройте .env на сервере
```bash
ssh root@92.46.127.98
cd /opt/overtime

# Отредактируйте .env — задайте реальные пароли и ключи
nano .env
```

> [!WARNING]
> Обязательно замените:
> - `POSTGRES_PASSWORD` — надёжный пароль
> - `SECRET_KEY` — сгенерируйте: `python3 -c "import secrets; print(secrets.token_hex(32))"`
> - `ALLOWED_ORIGINS=http://92.46.127.98`

#### 3.5 Первый запуск
```bash
cd /opt/overtime
bash deploy.sh

# Создайте администратора
docker exec overtime_backend python scripts/create_admin.py
```

#### 3.6 Проверка
Откройте в браузере: `http://92.46.127.98`

---

## 📂 Структура на продакшн-сервере

```
/opt/overtime/
├── docker-compose.yml     # (скопирован из docker-compose.prod.yml)
├── .env                   # Секреты (НЕ в Git)
├── nginx.conf             # Конфиг gateway
├── deploy.sh              # Скрипт обновления
├── deploy.log             # Лог деплоев (создаётся автоматически)
└── backups/               # Автобэкапы PostgreSQL
```

---

## 🔄 Обновление в будущем

После создания ВМ, обновление будет простым:

```bash
# На сервере
cd /opt/overtime && bash deploy.sh
```

Или, когда настроим автодеплой — автоматически при `git push`.
