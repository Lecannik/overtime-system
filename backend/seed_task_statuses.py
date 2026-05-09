import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.task import TaskStatus

async def seed_statuses():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(select(TaskStatus))
        if result.scalars().first():
            print("Statuses already seeded")
            return

        statuses = [
            {"name": "TODO", "color": "#94a3b8", "sort_order": 1},
            {"name": "IN PROGRESS", "color": "#3b82f6", "sort_order": 2},
            {"name": "REVIEW", "color": "#f59e0b", "sort_order": 3},
            {"name": "DONE", "color": "#10b981", "sort_order": 4},
            {"name": "BLOCKED", "color": "#ef4444", "sort_order": 5},
        ]

        for s in statuses:
            status = TaskStatus(**s)
            session.add(status)
        
        await session.commit()
        print("Default task statuses seeded successfully")

if __name__ == "__main__":
    asyncio.run(seed_statuses())
