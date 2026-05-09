import asyncio
import sys
import os
from datetime import datetime

sys.path.append("/app")

from app.core.database import get_session
from app.repositories import analytics as analytics_repo
from app.models.user import User

async def test_analytics():
    async for session in get_session():
        # Get an admin user
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.role.ilike("admin")))
        admin = res.scalars().first()
        
        if not admin:
            print("No admin user found for testing")
            return

        print(f"Testing analytics for user: {admin.email} (role: {admin.role})")
        
        # Test summary
        try:
            summary = await analytics_repo.get_analytics_summary(session)
            print(f"Summary: {summary}")
        except Exception as e:
            print(f"Summary failed: {e}")

        # Test projects
        try:
            projects = await analytics_repo.get_project_analytics(session)
            print(f"Projects count: {len(projects)}")
        except Exception as e:
            print(f"Projects failed: {e}")

        # Test departments
        try:
            depts = await analytics_repo.get_department_analytics(session)
            print(f"Depts count: {len(depts)}")
        except Exception as e:
            print(f"Depts failed: {e}")

        break

if __name__ == "__main__":
    asyncio.run(test_analytics())
