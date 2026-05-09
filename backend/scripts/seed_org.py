import asyncio
import sys
import os
from sqlalchemy import select

sys.path.append("/app")

from app.core.database import get_session
from app.models.organization import Department, JobPosition
from app.models.user import User, Role

async def seed_org():
    async for session in get_session():
        # 1. Ensure Roles exist
        roles_data = [
            {"name": "Admin", "description": "Administrator with full access"},
            {"name": "Manager", "description": "Project manager"},
            {"name": "Head", "description": "Department head"},
            {"name": "Employee", "description": "Regular employee"}
        ]
        
        for r_data in roles_data:
            res = await session.execute(select(Role).where(Role.name == r_data["name"]))
            if not res.scalars().first():
                role = Role(**r_data)
                session.add(role)
        
        await session.flush()

        # 2. Basic Departments
        depts_data = [
            {"name": "Directorate"},
            {"name": "IT Department"},
            {"name": "QA Department"},
            {"name": "Marketing"},
            {"name": "Sales"}
        ]
        
        for d_data in depts_data:
            res = await session.execute(select(Department).where(Department.name == d_data["name"]))
            if not res.scalars().first():
                dept = Department(**d_data)
                session.add(dept)
        
        await session.flush()
        
        # Get Directorate dept
        res = await session.execute(select(Department).where(Department.name == "Directorate"))
        directorate = res.scalars().first()

        # 3. Job Positions
        positions = [
            {"name": "General Director (CEO)", "parent_id": None},
            {"name": "Technical Director (CTO)", "parent_name": "General Director (CEO)"},
            {"name": "Commercial Director", "parent_name": "General Director (CEO)"},
            {"name": "HR Director", "parent_name": "General Director (CEO)"},
            {"name": "Project Manager", "parent_name": "Technical Director (CTO)"},
            {"name": "Team Lead", "parent_name": "Project Manager"},
            {"name": "Senior Engineer", "parent_name": "Team Lead"},
            {"name": "Engineer", "parent_name": "Senior Engineer"}
        ]

        created_positions = {}
        for pos_data in positions:
            res = await session.execute(select(JobPosition).where(JobPosition.name == pos_data["name"]))
            existing = res.scalars().first()
            if not existing:
                parent_id = None
                if pos_data.get("parent_name"):
                    parent_id = created_positions.get(pos_data["parent_name"])
                
                pos = JobPosition(name=pos_data["name"], parent_id=parent_id)
                session.add(pos)
                await session.flush()
                created_positions[pos_data["name"]] = pos.id
            else:
                created_positions[pos_data["name"]] = existing.id

        await session.commit()
        print("Organization seeded successfully!")
        break

if __name__ == "__main__":
    asyncio.run(seed_org())
