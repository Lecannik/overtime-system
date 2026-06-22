from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import hash_password, verify_password
from app.repositories import audit as audit_repo
from app.services.ms_graph import ms_graph
from app.services.otp import create_otp, verify_otp
from app.schemas.otp import OTPVerify, PasswordResetRequest, PasswordResetConfirm
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdatePreferences, UserChangePassword, LoginResponse
from app.services.auth import register_user, authenticate_user
from app.core.security import create_access_token
from app.api.deps import get_current_user
from app.models.user import User, OTPType
from app.repositories.user import update_user, get_user_by_email
from app.core.config import settings
from app.services.refresh_token import (
    create_refresh_token,
    verify_and_rotate_refresh_token,
    revoke_refresh_token,
)
from app.core.rate_limit import login_limiter


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, session: AsyncSession = Depends(get_session)):
    """
    Регистрация нового пользователя.
    """
    return await register_user(session, user_in)


@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    """
    Аутентификация пользователя и получение JWT токена.
    """
    login_limiter.check_limit(form_data.username)
    user = await authenticate_user(session, form_data.username, form_data.password)
    
    # ПРОВЕРКА 2FA
    if user.is_2fa_enabled:
        code = await create_otp(session, user.id, OTPType.login)
        await session.commit()
        
        # Отправляем код на почту
        await ms_graph.send_email(
            recipient=user.email,
            subject="Код подтверждения Overtime Pro",
            body_content=f"""
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">Твой код входа</h2>
                <p style="font-size: 1.2rem; font-weight: bold; letter-spacing: 5px; background: #f3f4f6; padding: 15px; border-radius: 8px; display: inline-block;">
                    {code}
                </p>
                <p style="color: #64748b; margin-top: 20px;">Срок действия кода: 10 минут.</p>
            </div>
            """
        )
        
        return {"status": "2fa_required", "email": user.email}

    # Логируем вход в систему
    await audit_repo.create_audit_log(
        session=session,
        user_id=user.id,
        action="LOGIN",
        details={"email": user.email}
    )
    
    # Создаем Refresh Token
    refresh_token = await create_refresh_token(session, user.id)
    await session.commit()
    
    # Устанавливаем куку
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    )
    
    token = create_access_token(data={"sub": str(user.id)})
    return {"status": "success", "access_token": token, "token_type": "bearer", "user": user}


@router.post("/verify-2fa", response_model=LoginResponse)
async def verify_login_2fa(
    response: Response,
    verify_in: OTPVerify,
    db: AsyncSession = Depends(get_session)
):
    """Верификация 2FA кода при входе."""
    login_limiter.check_limit(verify_in.email)
    user = await get_user_by_email(db, verify_in.email)
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
        
    is_valid = await verify_otp(db, user.id, verify_in.code, OTPType.login)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Неверный или просроченный код")
        
    # Логируем успешный вход
    await audit_repo.create_audit_log(
        session=db,
        user_id=user.id,
        action="LOGIN_2FA",
        details={"email": user.email}
    )
    
    # Создаем Refresh Token
    refresh_token = await create_refresh_token(db, user.id)
    await db.commit()
    
    # Устанавливаем куку
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    )
    
    token = create_access_token(data={"sub": str(user.id)})
    return {"status": "success", "access_token": token, "token_type": "bearer", "user": user}


@router.post("/refresh", response_model=LoginResponse)
async def refresh_session(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """
    Обновление Access Token с использованием Refresh Token в Cookie.
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Отсутствует сессионный токен"
        )
        
    new_refresh_token, user = await verify_and_rotate_refresh_token(session, refresh_token)
    
    # Устанавливаем новую куку (ротация)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    )
    
    new_access_token = create_access_token(data={"sub": str(user.id)})
    return {"status": "success", "access_token": new_access_token, "token_type": "bearer", "user": user}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """
    Выход из системы, отзыв Refresh Token и генерация URL для выхода из SSO Authentik.
    """
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        await revoke_refresh_token(session, refresh_token)
        
    response.delete_cookie(key="refresh_token")
    
    sso_logout_url = None
        
    return {
        "detail": "Успешный выход из системы",
        "sso_logout_url": sso_logout_url
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Получить информацию о текущем авторизованном пользователе.
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_my_preferences(
    pref_in: UserUpdatePreferences,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Обновить настройки уведомлений текущего пользователя."""
    updated_user = await update_user(db, current_user, pref_in.model_dump(exclude_unset=True))
    # Рефреш уже есть в update_user, но на всякий случай...
    return updated_user


@router.post("/change-password")
async def change_password(
    pass_in: UserChangePassword,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Смена пароля текущего пользователя."""
    if not verify_password(pass_in.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный старый пароль"
        )

    await update_user(db, current_user, {
        "hashed_password": hash_password(pass_in.new_password),
        "must_change_password": False
    })
    
    # Логируем смену пароля
    await audit_repo.create_audit_log(
        session=db,
        user_id=current_user.id,
        action="CHANGE_PASSWORD"
    )
    await db.commit()

    return {"detail": "Пароль успешно изменен"}


@router.post("/password-reset/request")
async def request_password_reset(
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_session)
):
    login_limiter.check_limit(req.email)
    user = await get_user_by_email(db, req.email)
    
    if user:
        code = await create_otp(db, user.id, OTPType.password_reset)
        await db.commit()
        
        await ms_graph.send_email(
            recipient=user.email,
            subject="Восстановление пароля Overtime Pro",
            body_content=f"""
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">Сброс пароля</h2>
                <p>Вы запросили сброс пароля. Используйте код ниже для подтверждения:</p>
                <div style="margin: 20px 0;">
                    <span style="font-size: 1.5rem; font-weight: bold; letter-spacing: 5px; background: #f3f4f6; padding: 15px 25px; border-radius: 8px; display: inline-block; color: #1e40af; border: 1px solid #dbeafe;">
                        {code}
                    </span>
                </div>
                <p style="color: #64748b; margin-top: 20px; font-size: 0.9rem;">Срок действия кода: 10 минут. Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
            </div>
            """
        )
    
    return {"detail": "Код восстановления отправлен на вашу почту, если она зарегистрирована в системе."}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    req: PasswordResetConfirm,
    db: AsyncSession = Depends(get_session)
):
    user = await get_user_by_email(db, req.email)
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
        
    is_valid = await verify_otp(db, user.id, req.code, OTPType.password_reset)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Неверный или просроченный код")
        
    await update_user(db, user, {
        "hashed_password": hash_password(req.new_password),
        "must_change_password": False
    })
    
    await audit_repo.create_audit_log(
        session=db,
        user_id=user.id,
        action="PASSWORD_RESET"
    )
    await db.commit()
    
    return {"detail": "Пароль успешно сброшен. Теперь вы можете войти с новым паролем."}


# --- Authentik OIDC Integration ---

from urllib.parse import urlencode
import httpx
from fastapi.responses import RedirectResponse
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
        "prompt": "select_account",
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
    if not all([settings.AUTHENTIK_BASE_URL, settings.AUTHENTIK_CLIENT_ID, settings.AUTHENTIK_CLIENT_SECRET, settings.AUTHENTIK_REDIRECT_URI]):
         raise HTTPException(
            status_code=500,
            detail="Настройки Authentik SSO не заданы в конфигурации бэкенда."
        )

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
        company_val = UserCompany.AJ_techCom if ("aj-tech" in email.lower() or "ajtech" in email.lower()) else UserCompany.Polymedia
        user = User(
            email=email,
            full_name=full_name,
            hashed_password="",
            role=UserRole.employee, # Дефолтная роль
            company=company_val,
            is_active=True,
            must_change_password=False,
            is_2fa_enabled=False
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        # Если пользователь входит через SSO, ему не нужно менять пароль локально,
        # даже если администратор импортировал его с флагом must_change_password=True.
        if user.must_change_password:
            user.must_change_password = False
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
    refresh_token = await create_refresh_token(session, user.id)
    await session.commit()
    
    # Установка сессионного токена в HTTPOnly Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        # samesite="lax" намеренно захардкожен для OIDC callback (cross-site flow),
        # чтобы кука передавалась после редиректа с внешнего SSO-провайдера.
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    )
    
    local_access_token = create_access_token(data={"sub": str(user.id)})
    
    # Перенаправляем пользователя на фронтенд-страницу успешного входа
    # ВАЖНО: Базовый домен должен совпадать с настройками фронтенда
    frontend_url = settings.FRONTEND_BASE_URL

    return RedirectResponse(
        url=f"{frontend_url}/auth/success?token={local_access_token}"
    )
