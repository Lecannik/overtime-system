import math
from datetime import datetime, timezone, timedelta

def calculate_overtime_hours(start_time: datetime, end_time: datetime) -> float:
    """
    Рассчитывает количество часов между двумя отметками времени,
    округляя в большую сторону до целого часа.
    """
    if not start_time or not end_time:
        return 0.0

    s_time = ensure_utc(start_time)
    e_time = ensure_utc(end_time)
    delta = e_time - s_time
    if delta.total_seconds() < 0:
        return 0.0
    return float(math.ceil(delta.total_seconds() / 3600))

def ensure_utc(dt: datetime | None) -> datetime | None:
    """
    Возвращает UTC-aware datetime. Наивные datetime считаются UTC.
    Используется вместо strip_timezone — мы больше не снимаем tzinfo,
    т.к. колонки start_time/end_time — timestamptz (хранят UTC явно).
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

# Обратная совместимость: analytics и другие модули импортируют strip_timezone.
# Теперь это ensure_utc — результат UTC-aware вместо naive.
strip_timezone = ensure_utc

def split_interval_by_days(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """
    Разделяет временной интервал на список интервалов,
    не пересекающих границы суток (00:00 по локальному времени из настроек).
    Возвращает список UTC-aware datetime объектов.
    """
    if not start or not end:
        return []

    from app.core.config import settings
    tz_local = settings.tz_info

    # Приведение к UTC-aware
    s_utc = ensure_utc(start)
    e_utc = ensure_utc(end)

    s_local = s_utc.astimezone(tz_local)
    e_local = e_utc.astimezone(tz_local)

    if e_local <= s_local:
        return []

    intervals_local = []
    current_start = s_local

    while True:
        next_day = current_start.date() + timedelta(days=1)
        next_midnight = datetime.combine(next_day, datetime.min.time(), tzinfo=tz_local)

        if e_local <= next_midnight:
            intervals_local.append((current_start, e_local))
            break
        else:
            intervals_local.append((current_start, next_midnight))
            current_start = next_midnight

    # Переводим в UTC-aware (tzinfo сохраняется)
    result = []
    for s, e in intervals_local:
        result.append((s.astimezone(timezone.utc), e.astimezone(timezone.utc)))

    return result
