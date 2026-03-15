import math
from datetime import datetime

def calculate_overtime_hours(start_time: datetime, end_time: datetime) -> float:
    """
    Рассчитывает количество часов между двумя отметками времени,
    округляя в большую сторону до целого часа.
    """
    if not start_time or not end_time:
        return 0.0
    
    delta = end_time - start_time
    # Делим секунды на 3600 и округляем вверх
    return float(math.ceil(delta.total_seconds() / 3600))

def strip_timezone(dt: datetime | None) -> datetime | None:
    """
    Удаляет информацию о часовом поясе из объекта datetime.
    Это необходимо для корректной работы с полями без временной зоны в SQLAlchemy.
    """
    if dt and dt.tzinfo:
        return dt.replace(tzinfo=None)
    return dt
