# Аудит проекта OvertimePro

**Дата аудита:** 2026-05-30
**Версия:** main @ `e900b0d`
**Аудитор:** Claude (Opus 4.7, 1M context)

---

## Резюме

В ходе анализа найдены **критические уязвимости безопасности**, **функциональные баги** и
**проблемы качества кода**, разбитые по приоритетам:

| Приоритет | Кол-во | Описание |
|-----------|--------|----------|
| 🔴 P0 — Критично | 7 | Уязвимости безопасности, рассинхрон API |
| 🟠 P1 — Высокий | 11 | Логические баги, потенциальные ошибки в рантайме |
| 🟡 P2 — Средний | 9 | Качество кода, технический долг |
| 🟢 P3 — Низкий | 6 | Косметика, оптимизации |

---

## 🔴 P0 — Критические проблемы

### P0-1. Падение бэкенда при отсутствующем пользователе в JWT (NullPointer)

**Файл:** `backend/app/api/deps.py:40-41`

```python
user = await get_user_by_id(session, int(user_id))
if not user.is_active:           # ← AttributeError, если user is None
```

Если пользователь удалён, а его JWT ещё валиден — бэкенд падает с `AttributeError`
вместо корректного 401. То же самое для `user.must_change_password` строкой ниже.

**Исправление:**
```python
user = await get_user_by_id(session, int(user_id))
if user is None:
    raise credentials_exception
if not user.is_active:
    ...
```

---

### P0-2. Хардкоженный production-домен в коде (две точки)

**Файл:** `backend/app/api/v1/auth.py:188-190, 456-458`

```python
if "overtime.polymedia.kz" in settings.ALLOWED_ORIGINS:
    frontend_url = "https://overtime.polymedia.kz"
```

Логика выбора URL для SSO-редиректа основана на substring-проверке вместо явной конфигурации.
Такой подход ломается при переезде домена и не масштабируется на multi-tenant.

**Исправление:** Ввести `FRONTEND_BASE_URL` в `Settings` и использовать его явно.

---

### P0-3. Незащищённая страница смены пароля

**Файл:** `frontend/src/App.tsx:73`

```jsx
<Route path="/change-password" element={<ChangePasswordPage />} />
```

`ChangePasswordPage` **не обёрнута в `ProtectedRoute`**. Хотя сам компонент делает `api.get('/auth/me')`
и редиректит при ошибке, это не защищает от XSS-сценариев и нарушает архитектурный контракт защиты роутов.

**Исправление:** Обернуть в `<ProtectedRoute>` или вынести минимальную проверку токена непосредственно в начало роута.

---

### P0-4. Cookie с `secure=True` ломает локальную разработку

**Файлы:** `backend/app/api/v1/auth.py:78-85, 122-130, 156-163, 442-449`

```python
response.set_cookie(
    key="refresh_token",
    value=refresh_token,
    httponly=True,
    secure=True,        # ← всегда True
    samesite="strict",
    ...
)
```

При локальном HTTP-окружении cookie не сохраняется → refresh не работает.
Также `samesite="strict"` блокирует cookie при OIDC-редиректах от Authentik (cross-site flow).

**Исправление:** Сделать `secure` зависимым от `settings.IS_PRODUCTION` (новая настройка),
а для OIDC-callback использовать `samesite="lax"`.

---

### P0-5. Несоответствие API между фронтом и бэком (Odoo)

**Файлы:** `frontend/src/services/api.ts:94-95` vs `backend/app/api/v1/admin.py:545, 604`

| Frontend | Backend |
|----------|---------|
| `GET /admin/odoo-projects` | `GET /admin/odoo/projects` |
| `POST /admin/import-odoo-projects` | `POST /admin/odoo/import` |

Импорт Odoo-проектов из админки **не работает** — 404 на оба эндпоинта.

**Исправление:** Привести фронт к бэку: `/admin/odoo/projects` и `/admin/odoo/import`,
тело POST — массив, не объект `{projects: [...]}`.

---

### P0-6. Криптографически слабая генерация OTP

**Файл:** `backend/app/services/otp.py:19`

```python
code = ''.join(random.choices(string.digits, k=6))
```

`random.choices` использует немодульный Mersenne Twister, **непригоден** для безопасности.
Для 2FA-кодов и сброса пароля обязателен криптостойкий RNG.

**Исправление:**
```python
import secrets
code = ''.join(secrets.choice(string.digits) for _ in range(6))
```

Дополнительно: **отсутствует rate-limiting на `verify_otp`** — можно перебрать 10⁶ кодов
за 10 минут. Нужно ограничить максимум 5 попыток и блокировать пользователя.

---

### P0-7. `echo=True` в SQLAlchemy в продакшне

**Файл:** `backend/app/core/database.py:19`

```python
engine = create_async_engine(DATABASE_URL, echo=True)
```

В production логирует **все SQL-запросы со значениями параметров**, включая пароли и токены.
Огромный объём логов + утечка чувствительных данных.

**Исправление:** `echo=settings.SQL_ECHO` (новая bool-настройка, дефолт `False`).

---

## 🟠 P1 — Высокий приоритет

### P1-1. Refresh-токен сравнивается без timezone-aware datetime

**Файл:** `backend/app/services/refresh_token.py:65`

```python
if db_token.expires_at < datetime.now(timezone.utc):
```

Если PostgreSQL вернёт naive datetime (зависит от драйвера), сравнение упадёт с `TypeError`.
Поле `expires_at` объявлено как `DateTime(timezone=True)` → asyncpg вернёт `tzinfo`, но это
неявная инвариантность. Рекомендуется явная нормализация.

---

### P1-2. Мёртвый код в логике защиты refresh-токенов

**Файл:** `backend/app/services/refresh_token.py:48-51`

```python
if db_token.revoked:
    await session.execute(
        select(RefreshToken).where(RefreshToken.user_id == db_token.user_id)
    )           # ← результат не используется, бесполезный запрос
    await session.execute(RefreshToken.__table__.update()...)
```

Первый `select` ничего не делает. Удалить.

---

### P1-3. `create_new_overtime` падает, если у проекта нет менеджера

**Файл:** `backend/app/services/overtime.py:84`

```python
manager = await user_repo.get_user_by_id(session, overtime.project.manager_id)
```

Если `project.manager_id is None` (а это разрешено `nullable=True`), вызов
`get_user_by_id(session, None)` отдаст что-то непредсказуемое
(или sqlalchemy кинет ошибку приведения типа). Аналогично для `dept.head_id` ниже —
там есть guard, но для менеджера его нет.

**Исправление:**
```python
manager = None
if overtime.project.manager_id:
    manager = await user_repo.get_user_by_id(session, overtime.project.manager_id)
```

---

### P1-4. Бизнес-логика "одобрено только начальником" неправильно работает при отсутствии лимита

**Файл:** `backend/app/services/overtime.py:172-186`

При `head_approved=True` и `weekly_hours <= weekly_limit` сразу ставит `APPROVED`.
Это противоречит описанию в `OvertimeReview` ("оба подтвердили = APPROVED").
Workflow становится непредсказуемым для пользователя.

**Действие:** Уточнить с заказчиком ожидаемое поведение и зафиксировать в тестах.

---

### P1-5. Race condition при создании "внутреннего" проекта

**Файл:** `backend/app/api/v1/projects.py:32-49`

```python
if not has_internal:
    ...
    internal_db = Project(...)
    db.add(internal_db)
    await db.commit()
```

Эндпоинт `GET /projects/` создаёт сущности при чтении (анти-паттерн). При параллельных запросах
получим **дубликаты** проектов "Внутренний". Логика инициализации должна быть в alembic-миграции
или в `lifespan` приложения.

---

### P1-6. XSS через имена в email-уведомлениях

**Файл:** `backend/app/services/notifications.py:158-159, 167, 172`

```python
<td>{overtime.project.name}</td>
...
<td>{reviewer.full_name}</td>
```

Имена проектов и пользователей вставляются в HTML-email без экранирования.
Если злоумышленник создаёт проект с именем `<script>...`, письмо может быть переслано
почтовым клиентом с уязвимостями. Telegram-сообщения экранируются (`html.escape` в `bot_service.py`),
но email — нет.

**Исправление:** Использовать `html.escape()` для всех вставляемых полей.

---

### P1-7. `delete_department/delete_project` не возвращают 204 при ошибке FK

**Файлы:** `backend/app/api/v1/admin.py:124-139, 241-256`

Если в отделе есть сотрудники / на проекте висят заявки, `delete()` упадёт с
`IntegrityError`. Сейчас падает в 500 без вменяемого сообщения.

**Исправление:** Обернуть в try/except и вернуть 409 Conflict с понятной ошибкой.

---

### P1-8. Telegram: рассинхронизация состояний `notification_level`

**Файлы:** `backend/app/models/user.py:55` vs `backend/app/services/notifications.py`,
`frontend/src/components/pages/ProfilePage.tsx:62-71`

В модели: `notification_level` комментарий "0: Off, 1: Major, 2: All".
В коде: проверяется `in (2, 3)` для Telegram, `in (1, 2)` для email.
В UI: переменная назначает `notifLvl = 3` (только Telegram). Уровень 3 нигде не задокументирован.

**Исправление:** Заменить magic numbers на enum (`NotificationLevel.OFF/EMAIL_ONLY/TG_ONLY/BOTH`).

---

### P1-9. `sessionmaker` вместо `async_sessionmaker` в SQLAlchemy 2.0

**Файл:** `backend/app/core/database.py:22-26`

```python
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

SQLAlchemy 2.0 даёт правильно типизированный `async_sessionmaker`. Текущий вариант работает,
но `mypy/pyright` ругается, и тип возвращаемой сессии — `Session`, а не `AsyncSession`.

---

### P1-10. Лимит `IP rate-limit` в nginx по IP легко обходится прокси

**Файл:** `infra/gateway/nginx.conf:1, 33-45`

10 r/m с одного IP. При NAT-выходе из офиса (или корпоративном прокси) все сотрудники делят
один IP → могут случайно достичь лимита. Также любой бот с резидентских прокси обойдёт.

**Действие:** Дополнить лимитом по email/username (на уровне Python, в Redis) и капчей после N попыток.

---

### P1-11. Жёстко закодированная таймзона +5

**Файл:** `backend/app/services/telegram.py:251` и `bot_service.py:68, 250`

```python
tz_plus_5 = timezone(timedelta(hours=5))
```

Asia/Almaty (+5) зашита в коде. Сломается для других стран/при переходе на летнее время.

**Исправление:** Брать таймзону из настроек проекта или из `User.timezone` (новое поле).

---

## 🟡 P2 — Средний приоритет

### P2-1. Дублирование зависимости в `requirements.txt`

**Файл:** `backend/requirements.txt:13, 33`

`openai-whisper` указан **дважды**. Безвредно, но создаёт путаницу.

---

### P2-2. Внешний pip-mirror в Dockerfile

**Файл:** `backend/Dockerfile:22`

```dockerfile
pip install ... -i https://pypi.tuna.tsinghua.edu.cn/simple ...
```

Сборка зависит от китайского зеркала. Если оно временно недоступно — сборка падает.
К тому же мирор может отдавать **устаревшие версии**.

**Исправление:** Использовать `pypi.org` (дефолт). При проблемах с скоростью — поднять локальный
`devpi` или `pip-cache`.

---

### P2-3. `logging.basicConfig` внутри модуля `ms_graph.py`

**Файл:** `backend/app/services/ms_graph.py:10`

```python
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
```

Модуль перенастраивает **глобальное** логирование на DEBUG. Это переопределяет настройки,
которые мог установить главный `main.py`. Конфиг логов должен быть только в одной точке (entry point).

---

### P2-4. MS Graph токен не кешируется

**Файл:** `backend/app/services/ms_graph.py:22-41`

Каждый запрос к Graph API создаёт новое `ConfidentialClientApplication` и запрашивает токен
заново. MSAL умеет кешировать токены (`acquire_token_silent`), но используется
`acquire_token_for_client` без кеша → дополнительная задержка и лимиты на стороне MS.

---

### P2-5. Inline imports в горячем пути

**Файлы:** `backend/app/api/v1/auth.py:73, 118, 152, 180, 437`,
`backend/app/api/v1/overtime.py:162-164`, `backend/app/api/v1/admin.py:272, 370`

Множество `from ... import ...` внутри функций. Замедляет первое выполнение, мешает анализу
зависимостей, рискует циклическими импортами.

---

### P2-6. `create_admin.py` хранит пароль `admin` в коде

**Файл:** `backend/scripts/create_admin.py:27`

```python
hashed_password=hash_password("admin"),
```

Скрипт создаёт админа с известным паролем без флага `must_change_password=True`. Если этот
скрипт когда-то выполняется в проде — катастрофа.

**Исправление:** Брать пароль из аргументов CLI / env, ставить `must_change_password=True`.

---

### P2-7. Магические числа года 1970 как "пустая дата"

**Файлы:** `backend/app/models/overtime.py:127`, `backend/app/repositories/overtime.py:234-238`,
`backend/app/services/overtime.py:304`, `backend/app/core/utils.py:14`

Условие `dt.year <= 1970` используется как маркер "это пустая/невалидная дата".
Анти-паттерн: следует использовать `None` (поле и так nullable).

---

### P2-8. `reset_user_password` возвращает пароль в ответе

**Файл:** `backend/app/api/v1/admin.py:387`

```python
return {"detail": f"Пароль пользователя ... сброшен на: {new_password}"}
```

Пароль отображается админу в UI и попадает в логи nginx. Кроме того, временный пароль
`"changeme123"` — слабый и хардкоженный.

**Исправление:** Генерировать случайный пароль, отправлять только по email, в ответе показывать
лишь "Пароль отправлен на email".

---

### P2-9. Frontend: localStorage для JWT — уязвимо к XSS

**Файл:** `frontend/src/services/api.ts:17, 28`

Access-токен лежит в `localStorage` → доступен любому скрипту. Любая XSS = захват сессии.
Refresh-токен правильно в HttpOnly cookie, но access всё равно в JS.

**Действие:** Перейти на in-memory хранение access-token + автообновление через refresh-cookie.

---

## 🟢 P3 — Низкий приоритет

### P3-1. Несогласованный импорт `get_db` vs `get_session`

В одних роутерах `from app.core.database import get_db` (alias), в других — `get_session`.
Привести к одному имени.

### P3-2. `requirements.txt` без фиксации версий ML-библиотек

`openai-whisper`, `transformers`, `sentencepiece` — без `==`. Не воспроизводимая сборка.

### P3-3. `Order by` в `analytics.py:245` через `text("total_hours DESC")` вместо колонки

Можно использовать `order_by(desc(total_hours_column))` — безопаснее и быстрее.

### P3-4. Внешние картинки с unsplash.com в LoginPage и ChangePasswordPage

Логин-страница тянет картинку с `images.unsplash.com` (`LoginPage.tsx:335`).
При проблемах с интернетом — пустой фон. Лучше положить локально в `public/`.

### P3-5. Версия `version: "3.9"` в docker-compose.yml устарела

В docker-compose v2+ поле `version` deprecated. Можно удалить.

### P3-6. `Notification.is_read` не возвращается клиенту

Схема `NotificationResponse` не показана, но фронт не имеет способа понять, какие уже прочитаны.
Стоит проверить, что поле сериализуется.

---

# 📋 Детальный план исправления

План разбит на **5 фаз** по приоритету и объёму работ. Каждая фаза независима и может быть
выпущена отдельным PR.

---

## Фаза 1 — Безопасность (1 день)

**Цель:** Закрыть критические уязвимости перед следующим деплоем.

| # | Задача | Файлы | Тесты |
|---|--------|-------|-------|
| 1.1 | Добавить null-check на `user` в `get_current_user` | `backend/app/api/deps.py` | Юнит-тест с удалённым user, ожидание 401 |
| 1.2 | Заменить `random.choices` на `secrets.choice` в OTP | `backend/app/services/otp.py` | Существующие тесты должны пройти |
| 1.3 | Добавить rate-limit на OTP verify (5 попыток / 10 мин в `user_otps`) | `backend/app/services/otp.py`, новая колонка `attempts` | Тест: 6-я попытка — 429 |
| 1.4 | Убрать `echo=True` из SQLAlchemy, ввести `SQL_ECHO` env | `backend/app/core/database.py`, `backend/app/core/config.py` | Manual: проверить, что в логах нет SQL |
| 1.5 | Завернуть `/change-password` в `ProtectedRoute` | `frontend/src/App.tsx` | E2E: переход с истекшим токеном → /login |
| 1.6 | Экранировать `html.escape` все user-controlled поля в email-шаблонах | `backend/app/services/notifications.py:_send_review_email` | Тест: project.name=`<script>` → не появляется в письме |
| 1.7 | Не возвращать сгенерированный пароль в ответе `/reset-password` | `backend/app/api/v1/admin.py:352-387` | Манульная проверка |

**Критерий приёмки:** Все 7 пунктов закрыты, security-review проведён.

---

## Фаза 2 — Функциональные баги (1-2 дня)

**Цель:** Починить пользовательские сценарии.

### 2.1. Восстановить импорт Odoo-проектов

- Привести URL во фронте: `/admin/odoo/projects` и `/admin/odoo/import`
- Изменить тело POST: передавать массив, не `{projects: [...]}`
- **Файлы:** `frontend/src/services/api.ts:94-95`, `frontend/src/components/pages/UsersPage.tsx`
- **Тест:** E2E импорт 3 проектов из Odoo

### 2.2. Защитить `create_new_overtime` от `None`-менеджера

- Файл: `backend/app/services/overtime.py:84`
- Добавить guard `if overtime.project.manager_id`
- **Тест:** Создание заявки в проекте без менеджера — успешно, без уведомления менеджеру

### 2.3. Race condition по "Внутреннему" проекту

- Убрать создание из `GET /projects/`
- Перенести в alembic-миграцию (data migration) или в `lifespan`
- **Файлы:** `backend/app/api/v1/projects.py`, новая миграция
- **Тест:** Параллельные запросы не создают дубликат

### 2.4. Обработка FK-конфликтов при удалении

- Обернуть `delete_department`, `delete_project` в try/except IntegrityError → 409
- **Файлы:** `backend/app/api/v1/admin.py:124-139, 241-256`
- **Тест:** Попытка удалить отдел с пользователем → 409

### 2.5. Хардкод домена → конфиг

- Ввести `FRONTEND_BASE_URL` в `Settings`
- Удалить substring-проверки `"overtime.polymedia.kz" in ...`
- **Файлы:** `backend/app/core/config.py`, `backend/app/api/v1/auth.py:188, 456`, `.env.prod.example`
- **Тест:** Логаут возвращает корректный URL для разных доменов

### 2.6. Cookie `secure=True` зависит от окружения

- Ввести `COOKIE_SECURE: bool` и `COOKIE_SAMESITE: Literal["lax","strict","none"]`
- **Файлы:** `backend/app/core/config.py`, все 4 места `set_cookie` в `auth.py`
- **Тест:** Локальная разработка по HTTP — refresh работает

**Критерий приёмки:** Регресс-тесты пройдены, ручная проверка ключевых сценариев.

---

## Фаза 3 — Технический долг (2 дня)

| # | Задача | Файлы |
|---|--------|-------|
| 3.1 | Заменить `random.choices` mention на TODO, удалить мёртвый `select` в refresh-token | `backend/app/services/refresh_token.py:48-51` |
| 3.2 | Заменить `sessionmaker` на `async_sessionmaker` | `backend/app/core/database.py` |
| 3.3 | Убрать `logging.basicConfig` из `ms_graph.py`, перенести в `main.py` | `backend/app/services/ms_graph.py`, `backend/app/main.py` |
| 3.4 | Кешировать MS Graph токен через `acquire_token_silent` | `backend/app/services/ms_graph.py` |
| 3.5 | Поднять inline-импорты на module-level | все API-роутеры |
| 3.6 | Удалить дубль `openai-whisper`, зафиксировать версии ML-зависимостей | `backend/requirements.txt` |
| 3.7 | Убрать pypi.tuna mirror из Dockerfile | `backend/Dockerfile:22` |
| 3.8 | Заменить magic 1970 на `None`-проверки | `backend/app/models/overtime.py`, `backend/app/repositories/overtime.py`, `backend/app/services/overtime.py`, `backend/app/core/utils.py` |
| 3.9 | Унифицировать `get_db` / `get_session` | все роутеры |
| 3.10 | `create_admin.py`: принимать пароль через CLI, ставить `must_change_password=True` | `backend/scripts/create_admin.py` |

---

## Фаза 4 — Frontend (1 день)

### 4.1. Перевести access-token из `localStorage` в память

- Завести `AuthProvider` контекст
- При логине сохранять токен в state + получать новый через refresh при `401`
- **Файлы:** `frontend/src/App.tsx`, `frontend/src/services/api.ts`, новый `AuthContext`
- **Риск:** Перезагрузка вкладки выкидывает в логин. Решение: автоматический refresh при mount, если есть `refresh_token` cookie

### 4.2. Заменить magic-numbers `notification_level` на enum

- Завести `enum NotificationLevel { Off, Email, Telegram, Both }`
- Привести бэкенд + UI к единому пониманию
- **Файлы:** `backend/app/models/user.py`, `frontend/src/types/index.ts`, `frontend/src/components/pages/ProfilePage.tsx`

### 4.3. Убрать внешние unsplash-картинки

- Скачать локально, положить в `frontend/public/login-bg.jpg`
- **Файлы:** `LoginPage.tsx:335`, `ChangePasswordPage.tsx:153`

---

## Фаза 5 — Инфраструктура и тесты (2 дня)

### 5.1. Покрытие тестами критических путей

Сейчас тесты есть, но покрытие неравномерно. Добавить:
- `test_auth.py`: 2FA, refresh-token rotation, OTP rate-limit
- `test_overtime.py`: workflow согласования (все ветки), race-конфликты
- `test_security.py`: XSS в email, удалённый user + валидный JWT

### 5.2. Logging configuration

- Завести `backend/app/core/logging.py` с единой настройкой (JSON-formatter, ротация)
- Убрать `print` из `admin.py:377-381` → `logger.info/error`

### 5.3. CI: добавить mypy / pyright

Сейчас CI запускает только `pytest` и `npm run lint`. Добавить:
- `mypy backend/app` или `pyright`
- `eslint --max-warnings 0` для frontend

### 5.4. CI: проверка отсутствия секретов

Подключить `gitleaks` action — гарантия, что `.env` не утечёт.

### 5.5. Health-check для бота и моделей

`/api/v1/health` проверяет только БД. Добавить:
- `tg_bot: running/stopped`
- `whisper_loaded: bool`
- `ms_graph_reachable: bool`

---

## Сводная оценка трудозатрат

| Фаза | Срок | Риск регресса |
|------|------|---------------|
| Фаза 1 — Безопасность | 1 день | Низкий |
| Фаза 2 — Баги | 1-2 дня | Средний (API контракты) |
| Фаза 3 — Тех. долг | 2 дня | Низкий |
| Фаза 4 — Frontend | 1 день | Средний (auth flow) |
| Фаза 5 — Infra/Tests | 2 дня | Низкий |
| **ИТОГО** | **7-8 рабочих дней** | |

---

## Рекомендуемый порядок мерджа

1. **Фаза 1** — отдельный PR, обязательное security-review.
2. **Фаза 2 (по пунктам)** — каждый пункт отдельным PR, чтобы откатить точечно при регрессе.
3. **Фаза 3 + Фаза 5.2** (логирование) — один PR "Tech debt cleanup".
4. **Фаза 4** — отдельный PR, обязательное E2E-тестирование auth flow.
5. **Фаза 5** — постепенно, по мере необходимости.

---

## Что НЕ вошло в план (вынесено в backlog)

- Переход с `print` на структурированное логирование везде
- Введение Redis для кеша + rate-limit
- Sentry / OpenTelemetry для трассировки
- Pre-commit hooks (black, isort, ruff)
- Документация API через OpenAPI 3 + хранение в репозитории
- Замена PyJWT на authlib для OIDC
- Полноценный i18n (сейчас русский зашит в коде)

Эти пункты можно обсудить отдельно после закрытия P0/P1.
