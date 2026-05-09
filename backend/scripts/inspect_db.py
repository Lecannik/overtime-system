import asyncio
import sys
import os
from sqlalchemy import select
from sqlalchemy.orm import selectinload

sys.path.append("/app")

from app.core.database import get_session
from app.models.user import User, Role, Permission
from app.models.organization import Department, JobPosition

async def check_db():
    async for session in get_session():
        # Check roles
        roles = await session.execute(select(Role).options(selectinload(Role.permissions)))
        print("--- ROLES ---")
        for r in roles.scalars().all():
            print(f"Role: {r.name} (id={r.id})")
            for p in r.permissions:
                print(f"  Permission: {p.name}")
        
        # Check departments
        depts = await session.execute(select(Department))
        print("\n--- DEPARTMENTS ---")
        for d in depts.scalars().all():
            print(f"Dept: {d.name} (id={d.id}, parent_id={d.parent_id}, manager_id={d.manager_id})")

        # Check job positions
        positions = await session.execute(select(JobPosition))
        print("\n--- JOB POSITIONS ---")
        for jp in positions.scalars().all():
            print(f"Pos: {jp.name} (id={jp.id}, parent_id={jp.parent_id})")

        # Check users
        users = await session.execute(select(User).options(selectinload(User.role_obj)))
        print("\n--- USERS ---")
        for u in users.scalars().all():
            role_name = u.role_obj.name if u.role_obj else u.role
            print(f"User: {u.full_name} ({u.email}), Role: {role_name}, Dept: {u.department_id}, Pos: {u.position_id}")
        
        break

if __name__ == "__main__":
    asyncio.run(check_db())
