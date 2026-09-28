from datetime import datetime
from typing import Optional, Any
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User


# Словарь сопоставления категорий действий для фильтрации
CATEGORY_ACTION_MAP: dict[str, list[str]] = {
    "auth": [
        "LOGIN",
        "LOGIN_2FA",
        "LOGIN_SSO",
        "LOGOUT",
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_RESET_CONFIRM",
        "PASSWORD_RESET",
        "CHANGE_PASSWORD",
        "RESET_PASSWORD",
    ],
    "security": [
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_RESET_CONFIRM",
        "PASSWORD_RESET",
        "CHANGE_PASSWORD",
        "RESET_PASSWORD",
    ],
    "users": [
        "CREATE_USER",
        "UPDATE_USER",
        "DELETE_USER",
        "RESET_PASSWORD",
        "IMPORT_USER_MS",
    ],
    "departments": [
        "CREATE_DEPT",
        "UPDATE_DEPT",
        "DELETE_DEPT",
    ],
    "projects": [
        "CREATE_PROJECT",
        "UPDATE_PROJECT",
        "DELETE_PROJECT",
        "IMPORT_ODOO_PROJECTS",
        "IMPORT_ODOO_INTEGRATION_PROJECTS",
        "IMPORT_PROJECT_ODOO",
        "IMPORT_PROJECT_ODOO_INTEGRATION",
    ],
    "overtimes": [
        "CREATE_OVERTIME",
        "UPDATE_OVERTIME_TIME",
        "ADMIN_UPDATE_OVERTIME",
        "CANCEL_OVERTIME",
        "RESTORE_OVERTIME",
        "DELETE_OVERTIME",
    ],
    "reviews": [
        "REVIEW_ADMIN",
        "REVIEW_HEAD",
        "REVIEW_MANAGER",
        "SELF_REVIEW_ADMIN",
        "REVIEW_HEAD_APPROVED",
        "REVIEW_HEAD_REJECTED",
        "REVIEW_MANAGER_APPROVED",
        "REVIEW_MANAGER_REJECTED",
    ],
    "system": [
        "AUTO_CLOSE_STALE",
    ],
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


async def _enrich_audit_details(session: AsyncSession, rows: list) -> dict[int, dict]:
    """
    Автоматически обогащает словарь details данных записей аудита информацией о сотруднике.

    Находит целевого сотрудника и дополняет details полями:
    - employee_id: идентификатор сотрудника
    - employee_name: ФИО сотрудника
    - employee_email: почта сотрудника

    Поиск сотрудника осуществляется:
    1. По прямому employee_id или user_id в details.
    2. По target_id заявки (Overtime.id -> Overtime.user_id -> User).

    :param session: Асинхронная сессия SQLAlchemy.
    :param rows: Список строк журнала аудита.
    :return: Словарь соответствия {row.id: enriched_details_dict}.
    """
    ot_ids: set[int] = set()
    direct_user_ids: set[int] = set()

    for row in rows:
        details = row.details or {}
        # Проверяем, нужно ли дополнить ФИО, email или employee_id
        if not details.get("employee_name") or not details.get("employee_email") or not details.get("employee_id"):
            if details.get("employee_id"):
                try:
                    direct_user_ids.add(int(details["employee_id"]))
                except (ValueError, TypeError):
                    pass
            elif details.get("user_id") and row.target_type == "overtime":
                try:
                    direct_user_ids.add(int(details["user_id"]))
                except (ValueError, TypeError):
                    pass

            if row.target_type == "overtime" and row.target_id:
                try:
                    ot_ids.add(int(row.target_id))
                except (ValueError, TypeError):
                    pass

    users_by_id: dict[int, dict[str, Any]] = {}
    ot_to_user_info: dict[int, dict[str, Any]] = {}

    if ot_ids:
        from app.models.overtime import Overtime
        ot_query = (
            select(Overtime.id, Overtime.user_id, User.full_name, User.email)
            .join(User, Overtime.user_id == User.id)
            .where(Overtime.id.in_(ot_ids))
        )
        ot_res = await session.execute(ot_query)
        for ot_id, u_id, full_name, email in ot_res.all():
            info = {"id": u_id, "name": full_name, "email": email}
            ot_to_user_info[ot_id] = info
            users_by_id[u_id] = info

    needed_user_ids = direct_user_ids - set(users_by_id.keys())
    if needed_user_ids:
        u_query = select(User.id, User.full_name, User.email).where(User.id.in_(needed_user_ids))
        u_res = await session.execute(u_query)
        for u_id, full_name, email in u_res.all():
            users_by_id[u_id] = {"id": u_id, "name": full_name, "email": email}

    enriched: dict[int, dict] = {}
    for row in rows:
        details = dict(row.details) if row.details else {}
        emp_info: dict[str, Any] | None = None

        # 1. Попытка через details.employee_id
        if details.get("employee_id"):
            try:
                emp_info = users_by_id.get(int(details["employee_id"]))
            except (ValueError, TypeError):
                pass

        # 2. Попытка через target_id (заявка)
        if not emp_info and row.target_type == "overtime" and row.target_id in ot_to_user_info:
            emp_info = ot_to_user_info[row.target_id]

        # 3. Попытка через details.user_id для заявок
        if not emp_info and row.target_type == "overtime" and details.get("user_id"):
            try:
                emp_info = users_by_id.get(int(details["user_id"]))
            except (ValueError, TypeError):
                pass

        if emp_info:
            if not details.get("employee_name") and emp_info.get("name"):
                details["employee_name"] = emp_info["name"]
            if not details.get("employee_email") and emp_info.get("email"):
                details["employee_email"] = emp_info["email"]
            if not details.get("employee_id") and emp_info.get("id"):
                details["employee_id"] = emp_info["id"]

        enriched[row.id] = details

    return enriched


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

    rows = result.all()
    enriched_details = await _enrich_audit_details(session, rows)

    items = []
    for row in rows:
        user_dict = None
        if row.user_full_name or row.user_email:
            user_dict = {
                "full_name": row.user_full_name or "Пользователь",
                "email": row.user_email
            }

        details = enriched_details.get(row.id, row.details)

        items.append({
            "id": row.id,
            "user_id": row.user_id,
            "user": user_dict,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "details": details,
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

    rows = result.all()
    enriched_details = await _enrich_audit_details(session, rows)

    items = []
    for row in rows:
        details = enriched_details.get(row.id, row.details)
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
            "details": details,
            "timestamp": row.created_at
        })

    return items