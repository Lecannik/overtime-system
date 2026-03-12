"""
System Settings repository
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.settings import SystemSetting

async def get_setting(session: AsyncSession, key: str) -> str | None:
    """
    Get system setting by key
    """
    result = await session.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else None

async def set_setting(session: AsyncSession, key: str, value: str) -> SystemSetting:
    """
    Set system setting by key
    """
    result = await session.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=key, value=value)
        session.add(setting)
    
    await session.commit()
    await session.refresh(setting)
    return setting