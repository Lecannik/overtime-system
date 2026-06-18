import math
from datetime import datetime, timezone, timedelta

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

def split_interval_by_days(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """
    Разделяет временной интервал на список интервалов,
    не пересекающих границы суток (00:00 по локальному времени из настроек).
    Возвращает список наивных datetime объектов в UTC.
    """
    if not start or not end:
        return []
        
    from app.core.config import settings
    tz_local = settings.tz_info
    
    # 1. Приведение к локальному времени
    s_utc = start.replace(tzinfo=timezone.utc) if not start.tzinfo else start.astimezone(timezone.utc)
    e_utc = end.replace(tzinfo=timezone.utc) if not end.tzinfo else end.astimezone(timezone.utc)
    
    s_local = s_utc.astimezone(tz_local)
    e_local = e_utc.astimezone(tz_local)
    
    if e_local <= s_local:
        return []
        
    # 2. Разделение по границам суток
    intervals_local = []
    current_start = s_local
    
    while True:
        # 00:00 следующего дня в локальном времени
        next_day = current_start.date() + timedelta(days=1)
        next_midnight = datetime.combine(next_day, datetime.min.time(), tzinfo=tz_local)
        
        if e_local <= next_midnight:
            intervals_local.append((current_start, e_local))
            break
        else:
            intervals_local.append((current_start, next_midnight))
            current_start = next_midnight
            
    # 3. Перевод обратно в наивный UTC
    result = []
    for s, e in intervals_local:
        s_utc_naive = s.astimezone(timezone.utc).replace(tzinfo=None)
        e_utc_naive = e.astimezone(timezone.utc).replace(tzinfo=None)
        result.append((s_utc_naive, e_utc_naive))
        
    return result
