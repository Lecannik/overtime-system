import asyncio
import sys
import os

# Добавляем путь к приложению, чтобы импорты работали корректно
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole, UserCompany
from app.models.organization import Department, Project
from app.models.overtime import Overtime
from app.models.audit import AuditLog
from app.repositories import user as user_repo

import secrets

async def create_admin():
    async with AsyncSessionLocal() as session:
        # Проверяем, существует ли уже админ
        existing_admin = await user_repo.get_user_by_email(session, "admin@example.com")
        if existing_admin:
            print("Администратор admin@example.com уже существует.")
            return

        password = secrets.token_urlsafe(16)
        admin = User(
            full_name="System Administrator",
            email="admin@example.com",
            hashed_password=hash_password(password),
            role=UserRole.admin,
            company=UserCompany.Polymedia,
            is_active=True,
            must_change_password=True
        )
        
        try:
            await user_repo.create_user(session, admin)
            print("✅ Администратор admin@example.com успешно создан.")
            print("📧 Email: admin@example.com")
            print(f"🔑 Временный пароль: {password}")
            print("⚠️ При первом входе в систему потребуется изменить этот пароль.")
        except Exception as e:
            print(f"❌ Ошибка при создании администратора: {e}")

if __name__ == "__main__":
    asyncio.run(create_admin())
