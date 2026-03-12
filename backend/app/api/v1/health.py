from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_session

router = APIRouter()

@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_session)):
    await session.execute(text("SELECT 1"))
    return {"status": "ok"}
