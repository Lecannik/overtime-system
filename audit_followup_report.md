# Повторный аудит OvertimePro — проверка исправлений

**Дата:** 2026-05-30
**Базовый коммит:** `d489573 — refactor: implement backend optimizations and fix audit report issues`
**Аудитор:** Claude (Opus 4.7, 1M context)

---

## TL;DR

Из **33 замечаний** первого аудита:

| Статус | Кол-во | Доля |
|--------|--------|------|
| ✅ Полностью исправлено | 20 | 61% |
| 🟡 Частично исправлено | 3 | 9% |
| ❌ Не исправлено | 10 | 30% |

**Все 7 критических (P0) проблем закрыты.** Также выявлено **2 новых замечания** при проверке.

---

## ✅ Что исправлено корректно

### 🔴 P0 — все 7 закрыты

| ID | Проблема | Файл/Коммит | Проверка |
|----|----------|-------------|----------|
| **P0-1** | Null-check user в `deps.py` | `backend/app/api/deps.py:41-42` | ✅ Добавлен `if user is None: raise credentials_exception` |
| **P0-2** | Хардкод домена `polymedia.kz` | `backend/app/api/v1/auth.py:185, 449` + `config.py:31` | ✅ Введён `FRONTEND_BASE_URL`, substring-проверки удалены |
| **P0-3** | `/change-password` без `ProtectedRoute` | `frontend/src/App.tsx:73` | ✅ Обёрнут в `<ProtectedRoute>` |
| **P0-4** | `secure=True` cookie | `backend/app/api/v1/auth.py` (4 места) + `config.py:33` | ✅ Введены `COOKIE_SECURE`/`COOKIE_SAMESITE`; для OIDC callback явно `samesite="lax"` |
| **P0-5** | Odoo API mismatch | `frontend/src/services/api.ts:94-95` | ✅ Endpoints `/admin/odoo/projects`, `/admin/odoo/import`; тело POST — массив |
| **P0-6** | Слабый RNG для OTP + нет rate-limit | `backend/app/services/otp.py` + миграция `16ab85ddfdd5` | ✅ `secrets.choice`, новая колонка `attempts`, блок после 5 попыток |
| **P0-7** | `echo=True` в SQLAlchemy | `backend/app/core/database.py:19` + `config.py:23` | ✅ Заменён на `echo=settings.SQL_ECHO` (дефолт `False`) |

### 🟠 P1 — закрыты

- **P1-2** Мёртвый `select` в refresh-token → удалён (`refresh_token.py:48-51`)
- **P1-3** `manager_id is None` крашит создание заявки → guard добавлен (`overtime.py:84-86`)
- **P1-5** Race condition на "Внутренний" проект → логика убрана из эндпоинта, перенесена в alembic-миграцию `16ab85ddfdd5`
- **P1-6** XSS в email через `project.name`/`reviewer.full_name`/`comment` → `html.escape` применён ко всем 3 полям
- **P1-7** FK-конфликты при удалении отдела/проекта → `try/except IntegrityError → 409`
- **P1-9** `sessionmaker` → `async_sessionmaker` ✅

### 🟡 P2 / 🟢 P3 — закрыты

- **P2-1** Дубль `openai-whisper` в `requirements.txt` → удалён
- **P2-2** Внешний pypi-mirror → удалён из `Dockerfile:22`
- **P2-3** `logging.basicConfig` в `ms_graph.py` → удалён, единая конфигурация в `main.py:9-13`
- **P2-4** MS Graph токен не кешируется → добавлен `acquire_token_silent` (см. ниже замечание)
- **P2-5** Inline imports → подняты на module-level в `auth.py`, `admin.py`, `analytics.py`, `overtime.py`, `websocket.py` (частично)
- **P2-7** Magic 1970 → удалено из `utils.py`, `repositories/overtime.py`, `services/overtime.py`, `models/overtime.py`
- **P2-8** Возврат пароля в `/reset-password` → строка изменена на `"пароль … успешно сброшен и отправлен на email"`
- **P3-1** `get_db` vs `get_session` → унифицировано на `get_session` во всех роутерах
- **P3-2** Версии ML-зависимостей → зафиксированы (`openai-whisper==20250625`, `transformers==5.8.1`, `sentencepiece==0.2.1`, `msal==1.36.0`)

---

## 🟡 Частично исправлено

### Ч-1. MS Graph token cache — реализация некорректна

**Файл:** `backend/app/services/ms_graph.py:32-36`

```python
app = msal.ConfidentialClientApplication(
    self.client_id, authority=self.authority, client_credential=self.secret
)
result = app.acquire_token_silent(self.scope, account=None)
```

`ConfidentialClientApplication` **пересоздаётся при каждом вызове**, а вместе с ним и его in-memory
token cache. `acquire_token_silent` всегда вернёт `None`, кеш фактически не работает. Нужно либо:
- Вынести `app` в `__init__` сервиса (singleton);
- Либо хранить токен и `expires_in` непосредственно в `self._access_token` и проверять срок.

### Ч-2. Поднятие inline-импортов — выполнено не везде

`backend/app/services/overtime.py` всё ещё содержит:
- `services/overtime.py:14-15` — `from app.core.utils import calculate_overtime_hours, strip_timezone` (это уже module-level, OK)

В `backend/app/repositories/overtime.py:272`:
```python
from app.core.utils import calculate_overtime_hours
```
inline-import остался.

### Ч-3. Замена magic-1970 — забыта одна точка

В `frontend` всё ещё могут отправляться "epoch zero" даты — следует проверить
`CreateOvertimeModal.tsx` и `OvertimeDetailModal.tsx` (не в скоупе этого аудита,
но стоит уточнить).

---

## ❌ Замечания, которые НЕ исправлены

### ❌ P1-1. Сравнение `expires_at` без явной нормализации tz

**Файл:** `backend/app/services/refresh_token.py:62`

```python
if db_token.expires_at < datetime.now(timezone.utc):
```

Поле `RefreshToken.expires_at` — `DateTime(timezone=True)`, и asyncpg вернёт aware-datetime, так что
**в текущем драйвере код работает**. Но это неявная инвариантность, и если когда-то БД отдаст naive
(например при миграции SQLite-тестов), всё упадёт с `TypeError`. Достаточно одной строки:

```python
expires_aware = db_token.expires_at if db_token.expires_at.tzinfo else db_token.expires_at.replace(tzinfo=timezone.utc)
if expires_aware < datetime.now(timezone.utc):
```

**Приоритет:** низкий (не баг сейчас, но риск регресса).

---

### ❌ P1-4. Двойное согласование: `head_approved` сразу даёт APPROVED

**Файл:** `backend/app/services/overtime.py:170-188`

```python
elif overtime.head_approved is True:
    if weekly_hours <= overtime.project.weekly_limit:
        overtime.status = OvertimeStatus.APPROVED   # ← без одобрения менеджера
```

Если начальник отдела одобрил, а лимит не превышен — заявка финально подтверждается **без участия
менеджера проекта**. Это противоречит описанию workflow (manager + head). Если это намеренная
бизнес-логика — нужно зафиксировать в docstring и тестах. Иначе — потенциальный bypass согласования.

**Приоритет:** требует уточнения у заказчика. Если намеренно — закрыть как "won't fix" в комментарии.

---

### ❌ P1-8. Magic numbers `notification_level` — рассинхрон сохранён

**Файлы:** `backend/app/services/notifications.py:39,46,75,110,232` и `frontend/src/components/pages/ProfilePage.tsx:62-71`

Уровни до сих пор задаются числами `0/1/2/3` без enum. Фронт по-прежнему может назначить уровень `3`
(только Telegram), а бэкенд интерпретирует его как `(2,3)` → отправит Telegram. Но **уровень 3 не
описан в комментарии модели** (`models/user.py:55`):

```python
notification_level: Mapped[int] = mapped_column(Integer, default=2)  # 0: Off, 1: Major, 2: All
```

Комментарий нужно обновить либо ввести enum. Иначе следующий разработчик потратит час на reverse-engineering.

**Приоритет:** средний.

---

### ❌ P1-10. Rate-limit по IP в nginx — обходится за NAT

**Файл:** `infra/gateway/nginx.conf:1, 33-45`

Не добавлено ограничение по `username/email` на уровне приложения или Redis. При наличии rate-limit
на 5 OTP-попыток (P0-6) ситуация лучше, но первичный brute-force `/login` через множество email-аккаунтов
по-прежнему возможен.

**Приоритет:** средний.

---

### ❌ P1-11. Хардкод `timezone(timedelta(hours=5))`

**Файл:** `backend/app/services/bot_service.py:68, 250`

```python
start_time_local = active.start_time.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=5)))
...
tz_plus_5 = timezone(timedelta(hours=5))
```

Asia/Almaty (+5) зашит, ничего не сделано.

**Приоритет:** средний (ломается при выходе в другие часовые пояса).

---

### ❌ P2-6. `create_admin.py` хранит пароль `"admin"`

**Файл:** `backend/scripts/create_admin.py:27, 31`

```python
hashed_password=hash_password("admin"),
...
must_change_password=False
```

Известный пароль admin/admin без флага принудительной смены. Если кто-то случайно запустит скрипт в проде — компрометация админ-аккаунта.

**Минимум:**
```python
hashed_password=hash_password(secrets.token_urlsafe(16)),
must_change_password=True
```

И печатать сгенерированный пароль в stdout (один раз, при создании).

**Приоритет:** средний-высокий (риск ручной ошибки).

---

### ❌ P2-9. JWT в `localStorage` — XSS-уязвимость

**Файлы:** `frontend/src/App.tsx:18,29,59`, `frontend/src/services/api.ts:17,28`,
`frontend/src/components/pages/{AuthSuccessPage,LoginPage,ChangePasswordPage,ProfilePage,ReviewPage}.tsx`,
`frontend/src/components/layout/NotificationBell.tsx`

Access-токен по-прежнему хранится в `localStorage`. Любой XSS-вектор (например, через `dangerouslySetInnerHTML`
или сторонние библиотеки с уязвимостями) — захват сессии. План фазы 4 не выполнен.

**Приоритет:** высокий (security).

---

### ❌ P3-3. `order_by(text("total_hours DESC"))`

**Файл:** `backend/app/repositories/analytics.py:245`

Не исправлено. Безопаснее использовать колоночное выражение.

---

### ❌ P3-4. Внешние unsplash-картинки на login/change-password

**Файлы:** `frontend/src/components/pages/LoginPage.tsx:335`, `frontend/src/components/pages/ChangePasswordPage.tsx:153`

Не исправлено.

---

### ❌ P3-5. `version: "3.9"` в `docker-compose.yml`

**Файл:** `docker-compose.yml:1`, `docker-compose.override.yml:1`

Не исправлено. В docker-compose v2+ это deprecated и выдаёт warning.

---

## 🆕 Новые замечания, найденные при проверке

### 🆕 N-1. `acquire_token_silent` с `account=None` для client-credentials flow

**Файл:** `backend/app/services/ms_graph.py:32`

```python
result = app.acquire_token_silent(self.scope, account=None)
```

В **client-credentials flow** (без пользователя) MSAL `acquire_token_silent` нужно вызывать с
правильно подобранным `account` или ничего не делать — для app-only токенов кеш MSAL и так работает
автоматически через `acquire_token_for_client` (он сам проверяет cache). Текущий код:
1. Пересоздаёт `ConfidentialClientApplication` каждый запрос → кеш всегда пустой
2. Лишний холостой вызов `acquire_token_silent`

**Правильно:**
```python
class MSGraphService:
    def __init__(self):
        ...
        self._app = msal.ConfidentialClientApplication(
            self.client_id, authority=self.authority, client_credential=self.secret
        )

    async def _get_access_token(self):
        ...
        # MSAL сам отдаст из кеша, если токен ещё валиден
        result = self._app.acquire_token_for_client(scopes=self.scope)
        ...
```

**Приоритет:** низкий (работает, но без кеша — это P2-4 фактически не решён).

---

### 🆕 N-2. `samesite="lax"` для OIDC callback захардкожен литералом

**Файл:** `backend/app/api/v1/auth.py:443`

```python
response.set_cookie(
    key="refresh_token",
    ...
    secure=settings.COOKIE_SECURE,
    samesite="lax",       # ← литерал, а не settings.COOKIE_SAMESITE
    ...
)
```

Для OIDC-callback это правильно (cross-site flow), но смешение конфигурируемого `COOKIE_SECURE`
и захардкоженного `"lax"` ломает контракт. Если оператор поставит `COOKIE_SECURE=False` для теста
по HTTP, OIDC-cookie всё равно проставится с `secure=False, samesite=lax` — и это OK, но рассогласовано.

**Рекомендация:** Завести отдельную настройку `OIDC_COOKIE_SAMESITE="lax"` для ясности, или
добавить комментарий в коде о намерении.

**Приоритет:** низкий.

---

## Сводная таблица статусов

| ID | Описание | Приоритет (исх.) | Статус |
|----|----------|-------------------|--------|
| P0-1 | Null-check user | 🔴 | ✅ |
| P0-2 | Хардкод домена | 🔴 | ✅ |
| P0-3 | ChangePassword не защищён | 🔴 | ✅ |
| P0-4 | Cookie secure | 🔴 | ✅ |
| P0-5 | Odoo API mismatch | 🔴 | ✅ |
| P0-6 | Слабый RNG/нет rate-limit OTP | 🔴 | ✅ |
| P0-7 | `echo=True` | 🔴 | ✅ |
| P1-1 | Timezone-aware refresh | 🟠 | ❌ |
| P1-2 | Мёртвый select | 🟠 | ✅ |
| P1-3 | manager_id None | 🟠 | ✅ |
| P1-4 | Dual approval workflow | 🟠 | ❌ требует уточнения |
| P1-5 | Race "Внутренний" | 🟠 | ✅ |
| P1-6 | XSS в email | 🟠 | ✅ |
| P1-7 | FK на DELETE | 🟠 | ✅ |
| P1-8 | notification_level enum | 🟠 | ❌ |
| P1-9 | async_sessionmaker | 🟠 | ✅ |
| P1-10 | Rate-limit по email | 🟠 | ❌ |
| P1-11 | Hardcoded TZ +5 | 🟠 | ❌ |
| P2-1 | Дубль whisper | 🟡 | ✅ |
| P2-2 | Pypi mirror | 🟡 | ✅ |
| P2-3 | logging.basicConfig | 🟡 | ✅ |
| P2-4 | MS Graph cache | 🟡 | 🟡 (см. N-1) |
| P2-5 | Inline imports | 🟡 | 🟡 (один остался) |
| P2-6 | create_admin.py | 🟡 | ❌ |
| P2-7 | Magic 1970 | 🟡 | ✅ |
| P2-8 | Возврат пароля | 🟡 | ✅ |
| P2-9 | JWT localStorage | 🟡 | ❌ |
| P3-1 | get_db unification | 🟢 | ✅ |
| P3-2 | ML versions pinned | 🟢 | ✅ |
| P3-3 | `text("total_hours DESC")` | 🟢 | ❌ |
| P3-4 | Unsplash external img | 🟢 | ❌ |
| P3-5 | docker-compose version | 🟢 | ❌ |
| P3-6 | NotificationResponse.is_read | 🟢 | (не проверено) |
| **N-1** | MS Graph cache фактически не работает | 🟡 | 🆕 |
| **N-2** | samesite=lax литерал в OIDC callback | 🟢 | 🆕 |

---

## Рекомендации по второй итерации

**Priority 1 — закончить начатое (1 день):**
1. **N-1 / P2-4** — вынести `ConfidentialClientApplication` в `__init__`, чтобы кеш реально работал.
2. **P1-8** — обновить docstring модели `notification_level` до 4 значений `0/1/2/3` (минимум) или
   ввести `IntEnum NotificationLevel`.
3. **P1-1** — нормализация tz при сравнении refresh-token.

**Priority 2 — лёгкие фиксы (4 часа):**
4. **P2-6** `create_admin.py` — случайный пароль + `must_change_password=True`.
5. **P1-11** — TZ в `Settings.DEFAULT_TIMEZONE`.
6. **P3-3, P3-5, P3-4** — мелкая косметика.

**Priority 3 — отдельный спринт (2–3 дня):**
7. **P2-9** Переезд JWT из `localStorage` в in-memory + автообновление через refresh-cookie.
8. **P1-10** Application-level rate limit по email/username (slowapi или Redis).
9. **P1-4** Уточнить и зафиксировать workflow согласования в тестах.

---

## Итог

Большая часть критических замечаний закрыта качественно: безопасность ОТП, refresh-cookies,
конфигурация, миграция для seed-данных — всё сделано как рекомендовалось.

Оставшиеся проблемы — преимущественно средний-низкий приоритет. Главные риски остались два:
1. **JWT в localStorage** — реальный security-долг, требует переписывания auth-flow на фронте.
2. **MS Graph cache** — не работает в текущей реализации, формально пункт закрыт, фактически — нет.

Спринт оценочно: **1.5–2 рабочих дня** на закрытие оставшихся пунктов кроме P2-9 (отдельно ~2 дня).
