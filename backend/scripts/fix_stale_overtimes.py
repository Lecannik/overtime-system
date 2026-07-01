"""
Скрипт для разовой очистки базы данных продакшена.
Находит все некорректные записи о переработке (у которых статус не IN_PROGRESS,
но поле end_time равно None) и автоматически закрывает их (приравнивая end_time к start_time).
"""

import asyncio
import sys
import os

# Добавляем путь к бэкенду для корректного импорта модулей приложения
sys.path.append(os.path.abspath("."))

from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.overtime import Overtime, OvertimeStatus

async def fix_stale_records():
    """
    Основная логика очистки записей.
    Находит PENDING/APPROVED/REJECTED/CANCELLED записи с end_time=None
    и выставляет им end_time = start_time (длительность 0 часов).
    """
    async with AsyncSessionLocal() as session:
        # Находим все записи, у которых нет end_time, но статус не IN_PROGRESS
        query = select(Overtime).where(
            Overtime.end_time.is_(None),
            Overtime.status != OvertimeStatus.IN_PROGRESS
        )
        res = await session.execute(query)
        stale_records = res.scalars().all()
        
        if not stale_records:
            print("Некорректных записей без времени окончания в базе данных не обнаружено.")
            return
            
        print(f"Найдено некорректных записей: {len(stale_records)}")
        for ot in stale_records:
            print(f"  Исправление: ID={ot.id}, UserID={ot.user_id}, Start={ot.start_time}, Status={ot.status}")
            # Приравниваем end_time к start_time, чтобы закрыть сессию на 0 часов
            ot.end_time = ot.start_time
            session.add(ot)
            
        await session.commit()
        print("База данных успешно исправлена и очищена!")

if __name__ == "__main__":
    asyncio.run(fix_stale_records())
