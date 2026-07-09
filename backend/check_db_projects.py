import asyncio
from app.core.database import AsyncSessionLocal
from app.repositories.organization import get_projects

async def main():
    async with AsyncSessionLocal() as session:
        projs = await get_projects(session)
        print("PROJ_LIST_START")
        for p in projs:
            print(f"ID: {p.id}, Code: {p.code}, Name: {p.name}, Active: {p.is_active}")
        print("PROJ_LIST_END")

if __name__ == "__main__":
    asyncio.run(main())
