"""
Репозиторий для работы с данными переработок.
Инкапсулирует SQL-логику и правила выборки данных из базы.
"""

from sqlalchemy import select, or_, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timedelta, timezone
from collections import defaultdict
from app.models.overtime import Overtime, OvertimeStatus
from app.models.organization import Project, Department
from app.models.user import User, UserRole

async def create_overtime(session: AsyncSession, overtime_db: Overtime) -> Overtime:
    """Сохраняет новую модель переработки в базу данных."""
    session.add(overtime_db)
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db

async def get_overtimes(
    session: AsyncSession, 
    current_user: User,
    status: OvertimeStatus | None = None,
    project_id: int | None = None,
    department_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = 1,
    page_size: int = 15,
    view: str | None = None,
    search: str | None = None
):
    """
    Получает список заявок с учетом прав доступа текущего пользователя,
    пагинации и поискового запроса.
    """
    # Базовый запрос
    base_query = select(Overtime).join(Project, Overtime.project_id == Project.id)
    base_query = base_query.join(User, Overtime.user_id == User.id)

    # Ограничение видимости по ролям
    filters = []
    if current_user.role == UserRole.admin:
        if view == "dashboard":
            filters.append(Overtime.user_id == current_user.id)
        else:
            pass 
    elif current_user.role == UserRole.employee:
        filters.append(Overtime.user_id == current_user.id)
    elif current_user.role == UserRole.head:
        if view == "review":
            # На странице согласования видит только свой отдел (где является начальником)
            my_depts = select(Department.id).where(Department.head_id == current_user.id)
            filters.append(User.department_id.in_(my_depts))
        elif view == "dashboard":
            # На главной странице видит только свои заявки
            filters.append(Overtime.user_id == current_user.id)
        else:
            # Legacy fallback: свои + подчиненные
            my_depts = select(Department.id).where(Department.head_id == current_user.id)
            filters.append(
                or_(
                    Overtime.user_id == current_user.id,
                    User.department_id.in_(my_depts)
                )
            )
    elif current_user.role == UserRole.manager:
        if view == "review":
            # На странице согласования видит только заявки по своим проектам
            filters.append(Project.manager_id == current_user.id)
        elif view == "dashboard":
            # На главной странице видит заявки по своим проектам + свои личные
            filters.append(
                or_(
                    Overtime.user_id == current_user.id,
                    Project.manager_id == current_user.id
                )
            )
        else:
            # Legacy fallback
            filters.append(
                or_(
                    Overtime.user_id == current_user.id,
                    Project.manager_id == current_user.id
                )
            )
    if view == "review":
        filters.append(Overtime.status != OvertimeStatus.IN_PROGRESS)

    # Дополнительные фильтры
    if status:
        filters.append(Overtime.status == status)
    if project_id:
        filters.append(Overtime.project_id == project_id)
    if department_id:
        filters.append(User.department_id == department_id)
    if start_date:
        from app.core.config import settings
        tz_local = settings.tz_info
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=tz_local).astimezone(timezone.utc)
        filters.append(Overtime.start_time >= start_datetime)
    if end_date:
        from app.core.config import settings
        tz_local = settings.tz_info
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=tz_local).astimezone(timezone.utc)
        filters.append(Overtime.start_time <= end_datetime)

    # Фильтр по поисковому запросу (ФИО, проект, описание, ID)
    if search:
        search_lower = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(User.full_name).like(search_lower),
                func.lower(Project.name).like(search_lower),
                func.lower(Overtime.description).like(search_lower),
                cast(Overtime.id, String).like(search_lower),
            )
        )

    # Применяем фильтры
    if filters:
        base_query = base_query.where(*filters)

    # 1. Считаем общее количество
    total_query = select(func.count(Overtime.id))
    if filters:
        # For the total count query, we need to re-apply joins if filters depend on them
        # This is a common pattern when building complex queries with dynamic joins/filters
        total_query = total_query.join(Project, Overtime.project_id == Project.id)\
                                 .join(User, Overtime.user_id == User.id)\
                                 .where(*filters)
    total_result = await session.execute(total_query)
    total = total_result.scalar()

    # 2. Получаем данные (пагинация)
    query = base_query.order_by(Overtime.created_at.desc())
    query = query.options(
        selectinload(Overtime.project),
        selectinload(Overtime.user)
    )
    
    if page_size > 0:
        query = query.limit(page_size).offset((page - 1) * page_size)

    result = await session.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size > 0 else 1
    }


async def get_overtime_by_id(session: AsyncSession, overtime_id: int) -> Overtime | None:
    """Получает одну заявку по ID с подгрузкой связанных данных проекта и пользователя."""
    query = (
        select(Overtime)
        .where(Overtime.id == overtime_id)
        .options(
            selectinload(Overtime.project),
            selectinload(Overtime.user),
        )
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()

async def get_active_session(session: AsyncSession, user_id: int) -> Overtime | None:
    """Ищет активную сессию (статус IN_PROGRESS) для конкретного пользователя."""
    query = (
        select(Overtime)
        .where(
            Overtime.user_id == user_id,
            Overtime.status == OvertimeStatus.IN_PROGRESS
        )
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(query)
    # Используем scalars().first() вместо scalar_one_or_none(), чтобы избежать падения
    # MultipleResultsFound, если в БД по ошибке застряло несколько активных сессий.
    return result.scalars().first()

async def get_all_stale_in_progress(session: AsyncSession, older_than_hours: int) -> list[Overtime]:
    """Возвращает все IN_PROGRESS сессии, которые не закрыты дольше older_than_hours часов."""
    from sqlalchemy.orm import selectinload as _sl
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    query = (
        select(Overtime)
        .where(
            Overtime.status == OvertimeStatus.IN_PROGRESS,
            Overtime.start_time < cutoff
        )
        .options(_sl(Overtime.project), _sl(Overtime.user))
    )
    result = await session.execute(query)
    return list(result.scalars().all())

async def update_overtime(session: AsyncSession, overtime_db: Overtime, update_data: dict) -> Overtime:
    """Обновляет поля переработки на основе словаря данных."""
    for key, value in update_data.items():
        setattr(overtime_db, key, value)
    
    await session.commit()
    await session.refresh(overtime_db)
    return overtime_db

async def get_personal_stats(session: AsyncSession, user_id: int):
    """
    Собирает расширенную статистику для дашборда пользователя.
    """
    # 1. Получаем все заявки пользователя для расчета агрегатов
    all_query = select(Overtime).where(Overtime.user_id == user_id)
    all_res = await session.execute(all_query)
    all_overtimes = all_res.scalars().all()

    # 2. Получаем только одобренные для графиков и суммы часов (с релейшном проекта)
    approved_query = (
        select(Overtime)
        .join(Project)
        .where(Overtime.user_id == user_id)
        .where(Overtime.status == OvertimeStatus.APPROVED)
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(approved_query)
    approved_overtimes = result.scalars().all()

    now = datetime.now(timezone.utc)
    this_month_start = date(now.year, now.month, 1)
    
    first_this_month = date(now.year, now.month, 1)
    last_month_end = first_this_month - timedelta(days=1)
    last_month_start = date(last_month_end.year, last_month_end.month, 1)

    this_month_hours = 0.0
    last_month_hours = 0.0
    total_approved_hours = 0.0
    project_map = defaultdict(float)
    daily_map = defaultdict(float)

    # Статистика за последние 30 дней
    thirty_days_ago = (now - timedelta(days=30)).date()

    for ot in approved_overtimes:
        h = ot.approved_hours if ot.approved_hours is not None else ot.hours
        total_approved_hours += h
        project_map[ot.project.name] += h
        
        ot_date = ot.start_time.date()
        if ot_date >= this_month_start:
            this_month_hours += h
        elif last_month_start <= ot_date <= last_month_end:
            last_month_hours += h
            
        if ot_date >= thirty_days_ago:
            daily_map[ot_date.isoformat()] += h

    # Считаем активные (ожидающие) заявки
    # Ожидающие = PENDING (ждем нач. отдела) + промежуточные согласования (ждем менеджера)
    active_requests = len([
        ot for ot in all_overtimes 
        if ot.status in [
            OvertimeStatus.PENDING, 
            OvertimeStatus.HEAD_APPROVED,
            OvertimeStatus.MANAGER_APPROVED
        ]
    ])

    by_project = [
        {"project_name": name, "hours": h} 
        for name, h in project_map.items()
    ]
    
    daily_stats = [
        {"date": d, "hours": h}
        for d, h in sorted(daily_map.items())
    ]

    return {
        "current_month_hours": round(this_month_hours, 1),
        "last_month_hours": round(last_month_hours, 1),
        "total_approved_hours": round(total_approved_hours, 1),
        "total_requests": len(all_overtimes),
        "active_requests": active_requests,
        "projects_count": len(project_map),
        "by_project": by_project,
        "daily_stats": daily_stats
    }

async def check_overlapping_overtimes(
    session: AsyncSession, 
    user_id: int, 
    start_time: datetime, 
    end_time: datetime | None,
    exclude_id: int | None = None
) -> bool:
    """
    Проверяет пересечение периодов. 
    Алгоритм: если (Начало1 < Конец2) и (Конец1 > Начало2), то есть пересечение.
    Учитывает, что конец периода может быть None (активная сессия в статусе IN_PROGRESS).
    """
    is_active_session = end_time is None
    
    # Активной бесконечной сессией считаем только те, которые реально находятся в процессе (IN_PROGRESS)
    db_active_condition = (Overtime.end_time.is_(None)) & (Overtime.status == OvertimeStatus.IN_PROGRESS)

    if is_active_session:
        overlap_condition = db_active_condition | (Overtime.end_time > start_time)
    else:
        overlap_condition = (Overtime.start_time < end_time) & (
            db_active_condition | (Overtime.end_time > start_time)
        )

    query = select(Overtime).where(
        Overtime.user_id == user_id,
        Overtime.status.notin_([OvertimeStatus.CANCELLED, OvertimeStatus.REJECTED]),
        overlap_condition
    )
    if exclude_id:
        query = query.where(Overtime.id != exclude_id)
        
    result = await session.execute(query)
    # Используем scalars().first() вместо scalar_one_or_none() для предотвращения падения
    return result.scalars().first() is not None

async def get_weekly_overtime_hours(session: AsyncSession, user_id: int, project_id: int) -> float:
    """
    Подсчет часов за текущую календарную неделю (с понедельника).
    Нужно для проверки лимитов проекта.
    """
    now = datetime.now(timezone.utc)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = select(Overtime).where(
        Overtime.user_id == user_id,
        Overtime.project_id == project_id,
        Overtime.status.notin_([OvertimeStatus.CANCELLED, OvertimeStatus.REJECTED]),
        Overtime.start_time >= monday
    )
    result = await session.execute(query)
    overtimes = result.scalars().all()
    
    from app.core.utils import calculate_overtime_hours
    return sum(calculate_overtime_hours(ot.start_time, ot.end_time) for ot in overtimes)

async def get_last_user_overtime(session: AsyncSession, user_id: int) -> Overtime | None:
    """
    Возвращает последнюю запись о переработке пользователя
    (в любом статусе, кроме CANCELLED) с подгруженным проектом.
    """
    query = (
        select(Overtime)
        .where(
            Overtime.user_id == user_id,
            Overtime.status != OvertimeStatus.CANCELLED
        )
        .order_by(Overtime.start_time.desc())
        .options(selectinload(Overtime.project))
    )
    result = await session.execute(query)
    return result.scalars().first()


async def get_calendar_summary(
    session: AsyncSession,
    current_user: User,
    month: str = None,
    year: int = None,
) -> dict:
    """
    Возвращает сводку заявок на переработку, сгруппированных по дням,
    для отображения в календарном виде (heatmap).

    Формат month: 'YYYY-MM'. Доступность данных ограничена правами пользователя.
    Дни в ответе форматируются как 'YYYY-MM-DD' (ISO 8601), отображение на
    фронтенде конвертирует их в формат ДД/ММ/ГГГГ.

    Args:
        session: Асинхронная сессия базы данных.
        current_user: Текущий авторизованный пользователь.
        month: Строка формата 'YYYY-MM', определяющая отображаемый месяц.
        year: Год для годовой сводки.

    Returns:
        Словарь вида {'YYYY-MM-DD': {'total': N, 'pending': N, 'approved': N,
        'hours': F, 'entries': [...]}}
    """
    from datetime import date as date_type
    import calendar as cal_module
    from app.core.config import settings
    tz_local = settings.tz_info

    if year:
        start_dt = datetime(year, 1, 1, 0, 0, 0).replace(tzinfo=tz_local).astimezone(timezone.utc)
        end_dt = datetime(year, 12, 31, 23, 59, 59).replace(tzinfo=tz_local).astimezone(timezone.utc)
    elif month:
        try:
            year_val, month_num = int(month[:4]), int(month[5:7])
        except (ValueError, IndexError):
            return {}
        first_day = date_type(year_val, month_num, 1)
        last_day = date_type(year_val, month_num, cal_module.monthrange(year_val, month_num)[1])
        start_dt = datetime.combine(first_day, datetime.min.time()).replace(tzinfo=tz_local).astimezone(timezone.utc)
        end_dt = datetime.combine(last_day, datetime.max.time()).replace(tzinfo=tz_local).astimezone(timezone.utc)
    else:
        return {}

    # Базовый запрос с учётом прав доступа
    base_query = (
        select(Overtime)
        .join(Project, Overtime.project_id == Project.id)
        .join(User, Overtime.user_id == User.id)
        .where(
            Overtime.start_time >= start_dt,
            Overtime.start_time <= end_dt,
            Overtime.status != OvertimeStatus.IN_PROGRESS,
        )
        .options(selectinload(Overtime.user))
    )

    # Ограничение видимости по ролям (аналогично get_overtimes с view="review")
    role_filters = []
    if current_user.role == UserRole.admin:
        pass  # Видит всё
    elif current_user.role == UserRole.employee:
        role_filters.append(Overtime.user_id == current_user.id)
    elif current_user.role == UserRole.head:
        my_depts = select(Department.id).where(Department.head_id == current_user.id)
        role_filters.append(User.department_id.in_(my_depts))
    elif current_user.role == UserRole.manager:
        role_filters.append(Project.manager_id == current_user.id)

    if role_filters:
        base_query = base_query.where(*role_filters)

    result = await session.execute(base_query)
    overtimes = result.scalars().all()

    # Группируем по дням (ключ: 'YYYY-MM-DD')
    summary: dict = defaultdict(lambda: {
        "total": 0,
        "pending": 0,
        "approved": 0,
        "hours": 0.0,
        "entries": []
    })

    pending_statuses = {OvertimeStatus.PENDING, OvertimeStatus.MANAGER_APPROVED, OvertimeStatus.HEAD_APPROVED}
    approved_statuses = {OvertimeStatus.APPROVED}

    for ot in overtimes:
        # Конвертируем UTC в локальную дату (ключ по дате начала)
        start_local = ot.start_time.astimezone(tz_local)
        day_key = start_local.strftime("%Y-%m-%d")

        day_data = summary[day_key]
        day_data["total"] += 1
        day_data["hours"] = round(day_data["hours"] + (ot.approved_hours or ot.hours or 0), 2)

        if ot.status in pending_statuses:
            day_data["pending"] += 1
        elif ot.status in approved_statuses:
            day_data["approved"] += 1

        user_name = ot.user.full_name if ot.user else "—"
        initials = "".join(p[0].upper() for p in user_name.split()[:2]) if user_name != "—" else "?"

        day_data["entries"].append({
            "id": ot.id,
            "initials": initials,
            "name": user_name,
            "hours": ot.approved_hours or ot.hours or 0,
            "status": str(ot.status.value),
        })

    return dict(summary)

