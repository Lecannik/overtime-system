import sys
import os
import asyncio
from sqlalchemy import select
from datetime import datetime, timedelta

# Добавляем путь к приложению
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), "backend")))

from app.core.database import AsyncSessionLocal as SessionLocal
from app.models.task import Task
from app.models.organization import Project
from app.models.user import User

async def seed():
    async with SessionLocal() as db:
        # Проверяем есть ли проекты
        proj_res = await db.execute(select(Project).limit(1))
        project = proj_res.scalar_one_or_none()
        
        if not project:
            print("No projects found. Cannot seed tasks.")
            return

        # Проверяем есть ли админ
        user_res = await db.execute(select(User).where(User.email == "new_admin@example.com"))
        user = user_res.scalar_one_or_none()
        
        if not user:
            print("Admin user not found.")
            return

        # Создаем тестовые задачи
        tasks_data = [
            {"title": "Разработка API", "description": "Создать эндпоинты для настроек", "status": "DONE", "priority": "HIGH"},
            {"title": "Верстка настроек", "description": "Сделать UI для админ-панели", "status": "IN_PROGRESS", "priority": "MEDIUM"},
            {"title": "Тестирование Канбана", "description": "Проверить Drag-and-Drop", "status": "TODO", "priority": "LOW"},
            {"title": "Оптимизация запросов", "description": "Ускорить работу аналитики", "status": "TODO", "priority": "HIGH"},
        ]

        for task_info in tasks_data:
            task = Task(
                title=f"{project.name}: {task_info['title']}",
                description=task_info['description'],
                status=task_info['status'],
                priority=task_info['priority'],
                type="OTHER",
                project_id=project.id,
                creator_id=user.id,
                deadline=datetime.utcnow() + timedelta(days=7)
            )
            db.add(task)
        
        await db.commit()
        print(f"Seed complete. 4 tasks added to project {project.name}.")

if __name__ == "__main__":
    asyncio.run(seed())
