# 🛡 Полное руководство: Интеграция Authentik (Native OIDC) в инфраструктуру OvertimePro

Этот документ содержит пошаговую техническую инструкцию по развертыванию единой точки входа (SSO) через Authentik на базе Proxmox для проекта OvertimePro и будущих сервисов.

---

## 1. Настройка Gateway VM (Nginx + DNS + SSL)

В качестве шлюза выступает отдельная виртуальная машина (1 vCPU, 1 ГБ RAM, 10 ГБ SSD, Ubuntu 24.04 LTS), имеющая белый IP-адрес (`92.46.127.98`) и находящаяся в одной внутренней сети (`192.168.20.0/24`) с остальными сервисами.

### 1.1. DNS Настройка
Убедитесь, что у вашего DNS-провайдера настроены A-записи, указывающие на ваш белый IP:
* `overtime.polymedia.kz` -> `92.46.127.98`
* `auth.polymedia.kz` -> `92.46.127.98`

### 1.2. Базовая настройка Nginx
Установите Nginx и Certbot на Gateway VM:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 1.3. Конфигурационные файлы Nginx

Создайте файл `/etc/nginx/sites-available/auth.polymedia.kz.conf`:
```nginx
server {
    listen 80;
    server_name auth.polymedia.kz;

    # Лог-файлы
    access_log /var/log/nginx/auth_access.log;
    error_log /var/log/nginx/auth_error.log;

    location / {
        proxy_pass http://192.168.20.23:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Увеличение таймаутов для долгих сессий websocket/обновлений
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Создайте файл `/etc/nginx/sites-available/overtime.polymedia.kz.conf`:
```nginx
server {
    listen 80;
    server_name overtime.polymedia.kz;

    access_log /var/log/nginx/overtime_access.log;
    error_log /var/log/nginx/overtime_error.log;

    # Максимальный размер загружаемого файла (важно для отчетов/аудио)
    client_max_body_size 50M;

    location / {
        proxy_pass http://192.168.20.21:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Активируйте конфигурации:
```bash
sudo ln -s /etc/nginx/sites-available/auth.polymedia.kz.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/overtime.polymedia.kz.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 1.4. Выпуск SSL Сертификатов (Let's Encrypt)
Запустите Certbot для автоматического выпуска и настройки HTTPS:
```bash
sudo certbot --nginx -d overtime.polymedia.kz -d auth.polymedia.kz
```
Certbot автоматически добавит SSL-настройки и настроит перенаправление с HTTP (80) на HTTPS (443) во всех конфигурационных файлах.

---

## 2. Authentik: Интеграция с Microsoft Graph (Entra ID)

Пользователи будут проходить аутентификацию в Authentik через корпоративные учетные записи Microsoft (Office 365).

### 2.1. Регистрация приложения в Azure Portal
1. Перейдите в **Azure Portal** -> **Microsoft Entra ID** -> **App registrations** -> **New registration**.
2. Введите название: `Authentik-SSO-Polymedia`.
3. Выберите тип поддерживаемых учетных записей (обычно *Accounts in this organizational directory only*).
4. Задайте Redirect URI (Web):
   ```
   https://auth.polymedia.kz/source/oauth/callback/entra-id/
   ```
5. После регистрации скопируйте:
   * **Application (client) ID**
   * **Directory (tenant) ID**
6. Перейдите в **Certificates & secrets** -> **New client secret** -> Задайте описание и срок действия -> Скопируйте **Value** (секрет виден только один раз).
7. Перейдите в **API permissions** -> **Add a permission** -> **Microsoft Graph** -> **Delegated permissions** -> Добавьте:
   * `openid`
   * `email`
   * `profile`
   * `User.Read`
8. Нажмите **Grant admin consent for [Имя компании]** для автоматического подтверждения разрешений всем пользователям.

### 2.2. Настройка Social Source в Authentik
1. Войдите в панель управления Authentik под администратором (`https://auth.polymedia.kz`).
2. Перейдите в **Directory** -> **Federation and Social login** -> Нажмите **Create**.
3. Выберите **Microsoft Entra ID OAuth Source**.
4. Заполните поля:
   * **Name**: `Microsoft Entra ID`
   * **Slug**: `entra-id` (должен совпадать со слагом в Callback URL в Azure)
   * **Consumer Key**: `<Application (client) ID>`
   * **Consumer Secret**: `<Client Secret>`
   * **Tenant ID**: `<Directory (tenant) ID>`
   * **User matching mode**: `Email (link)` (чтобы сопоставлять учетные записи по email, если они уже созданы в бэкенде OvertimePro)
5. Сохраните изменения.

---

## 3. Интеграция OvertimePro с Authentik (Native OIDC)

Мы регистрируем OvertimePro в Authentik как стандартное OIDC-приложение.

### 3.1. Создание OpenID Provider в Authentik
1. В Authentik перейдите в **Applications** -> **Providers** -> **Create**.
2. Выберите **OAuth2/OpenID Provider**.
3. Настройте провайдер:
   * **Name**: `OvertimePro Provider`
   * **Client type**: `Confidential`
   * **Client ID**: `overtime-app` (или оставьте автосгенерированный)
   * **Client Secret**: скопируйте сгенерированный секрет
   * **Redirect URIs**: `https://overtime.polymedia.kz/api/v1/auth/microsoft/callback`
   * **Signing Key**: выберите сертификат по умолчанию (например, `authentik Self-signed Certificate`)
   * **Subject mode**: `Based on the User's Email` (упрощает интеграцию с локальной БД, где уникальным ключом является email)
4. Нажмите **Finish**.

### 3.2. Создание Application в Authentik
1. Перейдите в **Applications** -> **Applications** -> **Create**.
2. Заполните:
   * **Name**: `OvertimePro`
   * **Slug**: `overtime`
   * **Provider**: Выберите созданный ранее `OvertimePro Provider`
3. Нажмите **Create**.

---

## 4. Изменения в кодовой базе OvertimePro

### 4.1. Конфигурация бэкенда (`backend/app/core/config.py` и `.env`)

В `.env.prod` пропишите:
```env
# Authentik OIDC
AUTHENTIK_BASE_URL=https://auth.polymedia.kz
AUTHENTIK_CLIENT_ID=overtime-app
AUTHENTIK_CLIENT_SECRET=ваш_секрет_провайдера_из_authentik
AUTHENTIK_REDIRECT_URI=https://overtime.polymedia.kz/api/v1/auth/microsoft/callback
```

В `backend/app/core/config.py` добавьте новые поля:
```python
    # Authentik OIDC Integration
    AUTHENTIK_BASE_URL: str | None = None
    AUTHENTIK_CLIENT_ID: str | None = None
    AUTHENTIK_CLIENT_SECRET: str | None = None
    AUTHENTIK_REDIRECT_URI: str | None = None
```

### 4.2. API эндпоинты в FastAPI (`backend/app/api/v1/auth.py`)

Добавим эндпоинт для перенаправления и callback-обработки:

```python
from urllib.parse import urlencode
import httpx
from fastapi.responses import RedirectResponse
from app.repositories.user import get_user_by_email, create_user
from app.models.user import UserRole, UserCompany

@router.get("/microsoft/login")
async def microsoft_login_redirect():
    """
    1. Перенаправление пользователя на авторизацию в Authentik
    """
    if not all([settings.AUTHENTIK_BASE_URL, settings.AUTHENTIK_CLIENT_ID, settings.AUTHENTIK_REDIRECT_URI]):
        raise HTTPException(
            status_code=500,
            detail="Настройки Authentik SSO не заданы в конфигурации бэкенда."
        )
        
    params = urlencode({
        "client_id": settings.AUTHENTIK_CLIENT_ID,
        "redirect_uri": settings.AUTHENTIK_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
    })
    
    # Редиректим на эндпоинт авторизации Authentik
    auth_url = f"{settings.AUTHENTIK_BASE_URL}/application/o/authorize/?{params}"
    return RedirectResponse(auth_url)


@router.get("/microsoft/callback")
async def microsoft_callback(
    code: str,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """
    2. Callback-обработчик OIDC от Authentik.
    Принимает code, обменивает на JWT, авторизует или создает пользователя в локальной БД.
    """
    # Шаг 2.1: Обмен authorization code на JWT токены Authentik
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"{settings.AUTHENTIK_BASE_URL}/application/o/token/",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.AUTHENTIK_REDIRECT_URI,
                "client_id": settings.AUTHENTIK_CLIENT_ID,
                "client_secret": settings.AUTHENTIK_CLIENT_SECRET,
            }
        )
    
    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось получить токен от Authentik: {token_resp.text}"
        )
    
    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    
    # Шаг 2.2: Запрос информации о пользователе (User Info) из Authentik
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            f"{settings.AUTHENTIK_BASE_URL}/application/o/userinfo/",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
    if userinfo_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось получить данные о пользователе от Authentik."
        )
        
    user_data = userinfo_resp.json()
    email = user_data.get("email")
    full_name = user_data.get("name") or user_data.get("preferred_username") or email
    
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Адрес электронной почты (email) не передан провайдером Authentik."
        )

    # Шаг 2.3: Поиск пользователя в локальной базе данных
    user = await get_user_by_email(session, email)
    
    # Авто-создание (Provisioning), если пользователь заходит впервые
    if not user:
        # Пароль для SSO-пользователей оставляем пустым, войти по паролю они не смогут
        user = User(
            email=email,
            full_name=full_name,
            hashed_password="",
            role=UserRole.employee, # Дефолтная роль
            company=UserCompany.Polymedia,
            is_active=True,
            must_change_password=False,
            is_2fa_enabled=False
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша учетная запись заблокирована в локальной системе."
        )

    # Шаг 2.4: Логирование успешного входа
    await audit_repo.create_audit_log(
        session=session,
        user_id=user.id,
        action="LOGIN_SSO",
        details={"email": user.email, "provider": "Authentik/Microsoft"}
    )

    # Шаг 2.5: Генерация локального JWT-токена доступа и сессионной куки
    from app.services.refresh_token import create_refresh_token
    refresh_token = await create_refresh_token(session, user.id)
    await session.commit()
    
    # Установка сессионного токена в HTTPOnly Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    )
    
    local_access_token = create_access_token(data={"sub": str(user.id)})
    
    # Перенаправляем пользователя на фронтенд-страницу успешного входа
    return RedirectResponse(
        url=f"https://overtime.polymedia.kz/auth/success?token={local_access_token}"
    )
```

### 4.3. Изменения на фронтенде React

1. **Добавление кнопки «Войти через Microsoft» на `frontend/src/components/pages/LoginPage.tsx`**:
```tsx
// Вставить в LoginPage.tsx (в блок рендеринга формы логина, под кнопкой ВОЙТИ В СИСТЕМУ)
const handleMicrosoftLogin = () => {
  // Перенаправляем пользователя на эндпоинт бэкенда, который инициирует OIDC
  window.location.href = 'https://overtime.polymedia.kz/api/v1/auth/microsoft/login';
};

// ... Внутри JSX разметки формы ...
<div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ИЛИ</span>
  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
</div>

<button
  type="button"
  onClick={handleMicrosoftLogin}
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: '56px',
    fontSize: '0.95rem',
    fontWeight: 800,
    borderRadius: '16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s ease'
  }}
>
  <svg width="20" height="20" viewBox="0 0 21 21">
    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
  </svg>
  ВОЙТИ ЧЕРЕЗ MICROSOFT
</button>
```

2. **Создание роута и страницы успешного входа `/auth/success`**:
Создайте компонент-страницу `frontend/src/components/pages/AuthSuccessPage.tsx`:
```tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthSuccessPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Сохраняем локальный JWT токен в localStorage
      localStorage.setItem('token', token);
      // Перенаправляем на дашборд
      navigate('/dashboard');
    } else {
      // Если токена нет — перенаправляем на страницу входа с ошибкой
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-primary)'
    }}>
      <h2>Авторизация успешна</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Перенаправление в систему...</p>
    </div>
  );
};

export default AuthSuccessPage;
```

Зарегистрируйте роут `/auth/success` в вашем `App.tsx` / `index.tsx` (компонент роутинга React).

---

## 5. Проверка и аудит безопасности системы

Перед вводом в эксплуатацию необходимо провести анализ по следующим направлениям:

### 5.1. Хранение секретов (Secrets Management)
* **Проблема**: Хранение секретов (`AUTHENTIK_CLIENT_SECRET`) в публичном Git-репозитории.
* **Решение**: Добавьте файл `.env` на продакшн-сервере в `.gitignore`. На ВМ конфигурационный `.env` должен создаваться вручную или копироваться через защищенные CI/CD механизмы (например, GitHub Actions Secrets).

### 5.2. CORS (Cross-Origin Resource Sharing)
Убедитесь, что бэкенд FastAPI настроен на работу со строгим списком разрешенных источников (Origins):
* В `.env` на бэкенде: `ALLOWED_ORIGINS=https://overtime.polymedia.kz`
* Проверьте, что в бэкенд-коде (`main.py`) CORS-опция `allow_origins` инициализируется из этого списка, исключая использование `*` в продакшне.

### 5.3. Open Redirect (Уязвимость перенаправления)
* **Проблема**: Злоумышленник может использовать параметр `redirect_uri` для перенаправления пользователя на фишинговый сайт.
* **Решение**:
  1. В Authentik жестко зафиксируйте `Redirect URIs` -> разрешать только `https://overtime.polymedia.kz/*`. Любые другие домены Authentik заблокирует на своей стороне.
  2. На бэкенде в `/microsoft/callback` редирект происходит на жестко прописанный адрес `https://overtime.polymedia.kz/auth/success`, что исключает внешнюю манипуляцию URL редиректа.

### 5.4. Валидация JWT и HTTPS-Only
1. Весь обмен авторизационными кодами (`code`) и токенами происходит только по зашифрованному протоколу HTTPS. На Gateway VM настроено принудительное перенаправление HTTP -> HTTPS.
2. Сессионная кука `refresh_token` на бэкенде выставляется со следующими флагами:
   * `httponly=True` (скрипты JS не могут прочесть токен, защита от XSS).
   * `secure=True` (кука передается только по HTTPS).
   * `samesite="strict"` (защита от CSRF-атак).
3. JWT-токен на бэкенде подписывается локальным `SECRET_KEY`. Длина ключа должна быть не менее 32 случайных байт (hex).
