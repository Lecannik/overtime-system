import time
from collections import defaultdict
from fastapi import HTTPException, status

class LoginRateLimiter:
    """
    Простой in-memory лимитер для ограничения количества попыток
    входа и сброса пароля по email на уровне приложения.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts = defaultdict(list)

    def check_limit(self, email: str):
        """
        Проверяет, превысил ли пользователь лимит попыток.
        Если превысил, выбрасывает HTTPException с кодом 429.
        """
        if not email:
            return
        
        email = email.lower().strip()
        now = time.time()
        
        # Очищаем устаревшие попытки
        self.attempts[email] = [t for t in self.attempts[email] if now - t < self.window_seconds]
        
        if len(self.attempts[email]) >= self.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Пожалуйста, попробуйте позже через минуту."
            )
        
        self.attempts[email].append(now)

# Создаем глобальный экземпляр лимитера
login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60)
