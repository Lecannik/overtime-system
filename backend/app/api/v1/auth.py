from fastapi import APIRouter, Depends, HTTPException, status
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


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, session: AsyncSession = Depends(get_session)):
    """
    Регистрация нового пользователя.
    """
    return await register_user(session, user_in)


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    """
    Аутентификация пользователя и получение JWT токена.
    """
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
    await session.commit()
    
    token = create_access_token(data={"sub": str(user.id)})
    return {"status": "success", "access_token": token, "token_type": "bearer", "user": user}


@router.post("/verify-2fa", response_model=LoginResponse)
async def verify_login_2fa(
    verify_in: OTPVerify,
    db: AsyncSession = Depends(get_session)
):
    """Верификация 2FA кода при входе."""
    from app.repositories.user import get_user_by_email
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
    await db.commit()
    
    token = create_access_token(data={"sub": str(user.id)})
    return {"status": "success", "access_token": token, "token_type": "bearer", "user": user}


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
