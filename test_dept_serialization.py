import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.organization import Department
from app.schemas.organization import DepartmentResponse
from app.core.config import settings
import json

DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:"
    f"{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_serialization():
    async with AsyncSessionLocal() as db:
        # Пытаемся создать отдел и сериализовать его
        dept = Department(name="Test Dept", extra_data={})
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        
        print(f"Created Department ID: {dept.id}")
        try:
            resp = DepartmentResponse.model_validate(dept)
            print("Serialization successful!")
            print(resp.model_dump_json(indent=2))
        except Exception as e:
            print(f"Serialization failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_serialization())
