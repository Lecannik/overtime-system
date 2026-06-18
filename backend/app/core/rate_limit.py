import time
from collections import defaultdict
from fastapi import HTTPException, Request, status


class LoginRateLimiter:
    """Лимитер по email — для auth endpoints (login, 2FA, сброс пароля)."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: defaultdict = defaultdict(list)

    def check_limit(self, email: str):
        if not email:
            return
        key = email.lower().strip()
        now = time.time()
        self.attempts[key] = [t for t in self.attempts[key] if now - t < self.window_seconds]
        if len(self.attempts[key]) >= self.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Попробуйте через минуту.",
            )
        self.attempts[key].append(now)


class IPRateLimiter:
    """Лимитер по IP-адресу — для API endpoints (создание заявок, admin операции)."""

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: defaultdict = defaultdict(list)

    def _get_ip(self, request: Request) -> str:
        # За nginx/reverse proxy берём реальный IP из заголовков
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"

    def check_limit(self, request: Request):
        ip = self._get_ip(request)
        now = time.time()
        self.attempts[ip] = [t for t in self.attempts[ip] if now - t < self.window_seconds]
        if len(self.attempts[ip]) >= self.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Попробуйте через минуту.",
            )
        self.attempts[ip].append(now)


# Auth: 5 попыток в минуту по email
login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60)

# Создание заявок: 20 в минуту с одного IP
overtime_create_limiter = IPRateLimiter(max_attempts=20, window_seconds=60)

# Admin мутации (create/update/delete/reset): 30 в минуту с одного IP
admin_limiter = IPRateLimiter(max_attempts=30, window_seconds=60)
