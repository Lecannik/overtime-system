from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from app.core.config import settings


# Настройка bcrypt для хеширования
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def hash_password(password: str) -> str:
    """Хеширует пароль"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Создает токен доступа"""
    to_encode = data.copy()
    # 1. Считаем, когда токен истечет
    # Используем время в формате UTC (стандарт для интернета)
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # 2. Добавляем поле "exp" (expiration time) - это стандарт JWT
    to_encode.update({"exp": expire})

    # 3. Собираем все вместе: данные + наш секретный ключ + алгоритм
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt
