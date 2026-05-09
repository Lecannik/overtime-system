import asyncio
from app.core.database import AsyncSessionLocal
from app.models.user import Role, Permission, User
from app.models.organization import Department, Project
from app.models.crm import CRMStage, Lead, Deal
from app.models.task import Task
from sqlalchemy import select, text

async def seed():
    async with AsyncSessionLocal() as session:
        # 1. Базовые права
        perms_list = ["view_all", "edit_all", "manage_org", "manage_crm"]
        db_perms = {}
        for p_name in perms_list:
            result = await session.execute(select(Permission).where(Permission.name == p_name))
            perm = result.scalar_one_or_none()
            if not perm:
                perm = Permission(name=p_name, description=f"Право на {p_name}")
                session.add(perm)
            db_perms[p_name] = perm
        await session.flush()

        # 2. Базовые роли
        roles_data = [
            {"name": "Admin", "perms": perms_list},
            {"name": "Manager", "perms": ["view_all", "manage_crm"]},
            {"name": "Employee", "perms": ["view_all"]}
        ]
        for r_data in roles_data:
            result = await session.execute(select(Role).where(Role.name == r_data["name"]))
            role = result.scalar_one_or_none()
            if not role:
                role = Role(name=r_data["name"], description=f"Роль {r_data['name']}")
                role.permissions = [db_perms[p] for p in r_data["perms"]]
                session.add(role)
        await session.flush()

        # 3. Базовые стадии CRM
        stages = [
            {"name": "Новый", "module": "LEAD", "color": "#3b82f6", "order": 1},
            {"name": "В работе", "module": "LEAD", "color": "#f59e0b", "order": 2},
            {"name": "Квалифицирован", "module": "LEAD", "color": "#10b981", "order": 3},
            {"name": "Не квалифицирован", "module": "LEAD", "color": "#ef4444", "order": 4},
            
            {"name": "Дискавери", "module": "DEAL", "color": "#3b82f6", "order": 1},
            {"name": "КП отправлено", "module": "DEAL", "color": "#f59e0b", "order": 2},
            {"name": "Договор", "module": "DEAL", "color": "#10b981", "order": 3}
        ]
        for s_data in stages:
            result = await session.execute(select(CRMStage).where(CRMStage.name == s_data["name"], CRMStage.module == s_data["module"]))
            if not result.scalar_one_or_none():
                stage = CRMStage(name=s_data["name"], module=s_data["module"], color=s_data["color"], sort_order=s_data["order"])
                session.add(stage)

        # 4. Обновление админа через сырой SQL (чтобы избежать проблем с Enum)
        admin_role_res = await session.execute(select(Role).where(Role.name == "Admin"))
        admin_role_id = admin_role_res.scalar_one().id
        
        await session.execute(
            text("UPDATE users SET role_id = :role_id WHERE email = :email"),
            {"role_id": admin_role_id, "email": "admin@example.com"}
        )
            
        await session.commit()
        print("✅ Сидирование успешно завершено!")

if __name__ == "__main__":
    asyncio.run(seed())
