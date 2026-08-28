from datetime import datetime
from typing import Optional
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User


# Словарь сопоставления категорий действий для фильтрации
CATEGORY_ACTION_MAP: dict[str, list[str]] = {
    "auth": ["LOGIN", "LOGOUT"],
    "security": ["PASSWORD_RESET_REQUEST", "PASSWORD_RESET_CONFIRM", "CHANGE_PASSWORD", "RESET_PASSWORD"],
    "users": ["CREATE_USER", "UPDATE_USER", "DELETE_USER"],
    "departments": ["CREATE_DEPT", "UPDATE_DEPT", "DELETE_DEPT"],
    "projects": ["CREATE_PROJECT", "UPDATE_PROJECT", "DELETE_PROJECT", "IMPORT_ODOO_PROJECTS", "IMPORT_ODOO_INTEGRATION_PROJECTS"],
    "overtimes": ["CREATE_OVERTIME", "UPDATE_OVERTIME_TIME", "CANCEL_OVERTIME", "RESTORE_OVERTIME"],
    "reviews": ["REVIEW_HEAD_APPROVED", "REVIEW_HEAD_REJECTED", "REVIEW_MANAGER_APPROVED", "REVIEW_MANAGER_REJECTED"],
    "system": ["AUTO_CLOSE_STALE"],
}


async def create_audit_log(
    session: AsyncSession, 
    user_id: int | None, 
    action: str, 
    target_type: str | None = None, 
    target_id: int | None = None, 
    details: dict | None = None
) -> AuditLog:
    """
    Создает новую запись в журнале аудита действий системы.

    :param session: Асинхронная сессия SQLAlchemy.
    :param user_id: ID пользователя, совершившего действие (None для системы).
    :param action: Строковый код действия (например, 'REVIEW_HEAD_APPROVED').
    :param target_type: Тип сущности ('overtime', 'user', 'department', 'project').
    :param target_id: Идентификатор целевой сущности.
    :param details: Дополнительные структурированные данные и изменения в формате JSON.
    :return: Созданный объект модели AuditLog.
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    session.add(log)
    await session.flush()
    return log


def _build_audit_filters(
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None
) -> list:
    """
    Формирует список условий WHERE для фильтрации журнала аудита.

    :param search: Поисковый запрос (ФИО, email, действие, тип объекта, ID, детали).
    :param start_date: Начальная дата выборки.
    :param end_date: Конечная дата выборки.
    :param category: Категория действий ('auth', 'overtimes', 'reviews', 'departments', 'projects', 'users', 'system').
    :return: Список условий SQLAlchemy.
    """
    filters = []

    if start_date:
        filters.append(AuditLog.created_at >= start_date)
    if end_date:
        filters.append(AuditLog.created_at <= end_date)

    if category and category.lower() in CATEGORY_ACTION_MAP:
        filters.append(AuditLog.action.in_(CATEGORY_ACTION_MAP[category.lower()]))

    if search:
        search_pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
                AuditLog.action.ilike(search_pattern),
                AuditLog.target_type.ilike(search_pattern),
                cast(AuditLog.target_id, String).ilike(search_pattern),
                cast(AuditLog.details, String).ilike(search_pattern),
            )
        )

    return filters


async def get_audit_logs(
    session: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None
) -> dict:
    """
    Получает пагинированный список записей аудита с расширенной фильтрацией.

    :param session: Асинхронная сессия SQLAlchemy.
    :param limit: Количество записей на страницу.
    :param offset: Смещение для пагинации.
    :param search: Строка поиска.
    :param start_date: Дата начала периода.
    :param end_date: Дата окончания периода.
    :param category: Категория действия.
    :return: Словарь с элементами 'items' и общим количеством 'total'.
    """
    filters = _build_audit_filters(search=search, start_date=start_date, end_date=end_date, category=category)

    # 1. Подсчет общего количества записей с учетом фильтрации
    total_query = select(func.count(AuditLog.id)).outerjoin(User, AuditLog.user_id == User.id)
    if filters:
        total_query = total_query.where(*filters)
    total_result = await session.execute(total_query)
    total = total_result.scalar() or 0

    # 2. Выборка данных записей
    query = select(
        AuditLog.id,
        AuditLog.user_id,
        User.full_name.label("user_full_name"),
        User.email.label("user_email"),
        AuditLog.action,
        AuditLog.target_type,
        AuditLog.target_id,
        AuditLog.details,
        AuditLog.created_at
    ).outerjoin(User, AuditLog.user_id == User.id)

    if filters:
        query = query.where(*filters)

    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)

    items = []
    for row in result.all():
        user_dict = None
        if row.user_full_name or row.user_email:
            user_dict = {
                "full_name": row.user_full_name or "Пользователь",
                "email": row.user_email
            }

        items.append({
            "id": row.id,
            "user_id": row.user_id,
            "user": user_dict,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "details": row.details,
            "timestamp": row.created_at
        })

    return {"items": items, "total": total}


async def get_audit_logs_for_export(
    session: AsyncSession,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None
) -> list[dict]:
    """
    Получает полный список записей аудита для выгрузки в Excel отчет.

    :param session: Асинхронная сессия SQLAlchemy.
    :param search: Строка поиска.
    :param start_date: Дата начала периода.
    :param end_date: Дата окончания периода.
    :param category: Категория действия.
    :return: Список словарей с данными логов аудита.
    """
    filters = _build_audit_filters(search=search, start_date=start_date, end_date=end_date, category=category)

    query = select(
        AuditLog.id,
        AuditLog.user_id,
        User.full_name.label("user_full_name"),
        User.email.label("user_email"),
        AuditLog.action,
        AuditLog.target_type,
        AuditLog.target_id,
        AuditLog.details,
        AuditLog.created_at
    ).outerjoin(User, AuditLog.user_id == User.id)

    if filters:
        query = query.where(*filters)

    query = query.order_by(AuditLog.created_at.desc())
    result = await session.execute(query)

    items = []
    for row in result.all():
        items.append({
            "id": row.id,
            "user_id": row.user_id,
            "user": {
                "full_name": row.user_full_name or ("Система" if not row.user_id else f"ID: {row.user_id}"),
                "email": row.user_email
            },
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "details": row.details,
            "timestamp": row.created_at
        })

    return items