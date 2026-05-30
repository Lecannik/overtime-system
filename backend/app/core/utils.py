import math
from datetime import datetime, timezone

def calculate_overtime_hours(start_time: datetime, end_time: datetime) -> float:
    """
    Рассчитывает количество часов между двумя отметками времени,
    округляя в большую сторону до целого часа.
    """
    if not start_time or not end_time:
        return 0.0
    
    s_time = strip_timezone(start_time)
    e_time = strip_timezone(end_time)
    delta = e_time - s_time
    if delta.total_seconds() < 0:
        return 0.0
    # Делим секунды на 3600 и округляем вверх
    return float(math.ceil(delta.total_seconds() / 3600))

def strip_timezone(dt: datetime | None) -> datetime | None:
    """
    Удаляет информацию о часовом поясе из объекта datetime,
    предварительно приводя время к UTC.
    Это необходимо для корректной работы с полями без временной зоны в SQLAlchemy.
    """
    if dt and dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt
