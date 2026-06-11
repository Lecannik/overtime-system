import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.organization import Project, Department
from app.models.overtime import Overtime
from app.models.user import User
from app.models.notification import Notification

async def main():
    async with AsyncSessionLocal() as session:
        # Projects
        res = await session.execute(select(Project))
        projects = res.scalars().all()
        print("=== Projects ===")
        for p in projects:
            print(f"ID={p.id}, Name={p.name!r}")
            
        # Departments
        res = await session.execute(select(Department))
        depts = res.scalars().all()
        print("\n=== Departments ===")
        for d in depts:
            print(f"ID={d.id}, Name={d.name!r}")
            
        # Overtimes
        res = await session.execute(select(Overtime).order_by(Overtime.start_time.desc()).limit(15))
        overtimes = res.scalars().all()
        print("\n=== Overtimes ===")
        for ot in overtimes:
            print(f"ID={ot.id}, UserID={ot.user_id}, ProjectID={ot.project_id}, Start={ot.start_time}, End={ot.end_time}, Status={ot.status}, Hours={ot.hours}")

        # Notifications
        res = await session.execute(select(Notification).order_by(Notification.created_at.desc()).limit(30))
        notifications = res.scalars().all()
        print("\n=== Notifications ===")
        for n in notifications:
            print(f"ID={n.id}, UserID={n.user_id}, Title={n.title!r}, Message={n.message!r}, Read={n.is_read}, Created={n.created_at}")

if __name__ == "__main__":
    asyncio.run(main())

