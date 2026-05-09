from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.permissions import StagePermission
from typing import List, Optional

class PermissionRepository:
    """Управление правами доступа к стадиям."""

    @staticmethod
    async def get_permissions(
        db: AsyncSession, 
        position_id: Optional[int] = None, 
        user_id: Optional[int] = None
    ) -> List[StagePermission]:
        query = select(StagePermission)
        if position_id:
            query = query.where(StagePermission.position_id == position_id)
        if user_id:
            query = query.where(StagePermission.user_id == user_id)
        
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def sync_permissions(
        db: AsyncSession, 
        allowed_stage_ids: List[int],
        position_id: Optional[int] = None, 
        user_id: Optional[int] = None
    ):
        """Пакетное обновление разрешенных стадий."""
        # 1. Удаляем текущие права
        if position_id:
            stmt = delete(StagePermission).where(StagePermission.position_id == position_id)
        elif user_id:
            stmt = delete(StagePermission).where(StagePermission.user_id == user_id)
        else:
            return
            
        await db.execute(stmt)
        
        # 2. Создаем новые
        for stage_id in allowed_stage_ids:
            perm = StagePermission(
                position_id=position_id,
                user_id=user_id,
                stage_id=stage_id,
                can_view=True
            )
            db.add(perm)
            
        await db.commit()
        return True

    @staticmethod
    async def get_all_matrix(db: AsyncSession):
        """Возвращает все права для отображения в админ-матрице."""
        result = await db.execute(select(StagePermission))
        return list(result.scalars().all())
