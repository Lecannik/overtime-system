"""
Второй набор тестов безопасности и отказоустойчивости системы Overtime (Часть 2).
Файл проверяет целостность данных, перехват ошибок уникальности (409 Conflict),
валидацию лимитов проектов (ge=0), валидацию диапазонов дат в аналитике и обработку уведомлений (404).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Project, Department
from app.models.user import User, UserRole, UserCompany
from app.models.notification import Notification
from app.core.security import hash_password, create_access_token


# =====================================================================
# НАПРАВЛЕНИЕ: Целостность данных и серверные сбои
# =====================================================================

@pytest.mark.asyncio
async def test_duplicate_project_code_crashes_with_500_instead_of_409(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    manager_user: User
):
    """
    Суть проверяемого сценария:
        Администратор создает проект с кодом '2026-88881'.
        Затем пытается создать второй проект с таким же кодом '2026-88881'.
        Сервер должен перехватывать IntegrityError и возвращать 409 Conflict.
    """
    # 1. Создаем первый проект с валидным форматом кода (YYYY-NNNNN)
    resp1 = await client.post(
        "/api/v1/admin/projects",
        json={
            "name": "Проект Альфа",
            "code": "2026-88881",
            "weekly_limit": 40,
            "manager_id": manager_user.id
        },
        headers=admin_token_headers
    )
    assert resp1.status_code == 201

    # 2. Пытаемся создать проект с дублирующимся кодом
    resp2 = await client.post(
        "/api/v1/admin/projects",
        json={
            "name": "Проект Бета Дубликат",
            "code": "2026-88881",
            "weekly_limit": 40,
            "manager_id": manager_user.id
        },
        headers=admin_token_headers
    )

    # Проверка защиты: Сервер возвращает 409 Conflict при дубликате кода проекта
    assert resp2.status_code == 409, (
        f"Ожидался статус 409 Conflict, получен {resp2.status_code}"
    )
    assert "уже существует" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_negative_project_weekly_limit_bypasses_validation(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_user: User
):
    """
    Суть проверяемого сценария:
        Администратор пытается создать проект с отрицательным лимитом часов (weekly_limit = -50).
        Pydantic-схема ProjectCreate должна отклонить запрос со статусом 422 Unprocessable Entity.
    """
    resp = await client.post(
        "/api/v1/admin/projects",
        json={
            "name": "Проект с отрицательным лимитом",
            "code": "2026-88882",
            "weekly_limit": -50,
            "manager_id": manager_user.id
        },
        headers=admin_token_headers
    )

    # Проверка защиты: Отрицательный лимит отклоняется валидатором (422 Unprocessable Entity)
    assert resp.status_code == 422, (
        f"Ожидалась ошибка валидации (422 Unprocessable Entity), получен {resp.status_code}"
    )


# =====================================================================
# НАПРАВЛЕНИЕ: Аналитика и валидация временных диапазонов
# =====================================================================

@pytest.mark.asyncio
async def test_analytics_inverted_date_range_unvalidated(
    client: AsyncClient,
    admin_token_headers: dict
):
    """
    Суть проверяемого сценария и входные данные:
        Пользователь запрашивает сводную аналитику с инвертированным диапазоном дат:
        GET /api/v1/analytics/summary?start_date=2026-12-31&end_date=2026-01-01.

    Какое корректное поведение ожидается:
        Сервер должен валидировать логическую корректность диапазона (start_date <= end_date)
        и возвращать ошибку 400 Bad Request или 422 Unprocessable Entity.

    Что фактически происходит (ошибка/уязвимость/сбой):
        В модуле app/api/v1/analytics.py валидация диапазона отсутствует.
        Сервер успешно выполняет SQL-запрос с противоречивым условием (start_time >= 2026-12-31 AND start_time <= 2026-01-01),
        возвращая статус 200 OK с нулевыми показателями.

    Риски для системы:
        Введение пользователей и руководства в заблуждение пустыми отчетами,
        потенциальные логические аномалии при генерации заголовков экспортных файлов Excel.
    """
    resp = await client.get(
        "/api/v1/analytics/summary?start_date=2026-12-31&end_date=2026-01-01",
        headers=admin_token_headers
    )

    # Проверка защиты: Запрос с инвертированными датами отклоняется с ошибкой 422
    assert resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity, получен {resp.status_code}"
    )
    assert "не может быть позже" in resp.json()["detail"]


# =====================================================================
# НАПРАВЛЕНИЕ: Уведомления и маскировка статусов
# =====================================================================

@pytest.mark.asyncio
async def test_notification_status_blind_success_on_other_users_notification(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    admin_user: User
):
    """
    Суть проверяемого сценария и входные данные:
        В системе создается уведомление, адресованное администратору (admin_user.id).
        Обычный сотрудник (normal_user) отправляет запрос на отметку чужого уведомления
        как прочитанного: POST /api/v1/notifications/{admin_notification_id}/read.

    Какое корректное поведение ожидается:
        Если уведомление не принадлежит текущему пользователю, API должно возвращать
        404 Not Found (или 403 Forbidden).

    Что фактически происходит (ошибка/уязвимость/сбой):
        В репозитории app/repositories/notification.py метод mark_as_read выполняет
        слепой UPDATE с условием user_id = current_user.id, затрагивая 0 строк.
        Роут POST /api/v1/notifications/{id}/read не проверяет количество измененных строк
        и возвращает {"status": "ok"} со статусом 200 OK!

    Риски для системы:
        Ложная обратная связь для клиента: приложение сообщает об успешном изменении состояния,
        хотя фактически операция была проигнорирована или заблокирована.
    """
    # 1. Создаем уведомление для администратора
    notif = Notification(
        user_id=admin_user.id,
        title="Административное оповещение",
        message="Конфиденциальное системное сообщение",
        is_read=False
    )
    db_session.add(notif)
    await db_session.commit()
    await db_session.refresh(notif)

    # 2. Обычный сотрудник отправляет запрос на прочтение чужого уведомления
    resp = await client.post(
        f"/api/v1/notifications/{notif.id}/read",
        headers=normal_user_token_headers
    )

    # Проверка защиты: Сервер возвращает 404 Not Found при попытке изменить чужое уведомление
    assert resp.status_code == 404, (
        f"Ожидался статус 404 Not Found, получен {resp.status_code}"
    )
    assert "не найдено" in resp.json()["detail"].lower()

    # Проверяем, что в БД уведомление администратора так и осталось непрочитанным
    query = select(Notification).where(Notification.id == notif.id)
    result = await db_session.execute(query)
    current_notif = result.scalar_one()
    assert current_notif.is_read is False, "Уведомление не должно было быть помечено прочитанным"


# =====================================================================
# НАПРАВЛЕНИЕ: BFLA / Разграничение прав на создание проектов
# =====================================================================

@pytest.mark.asyncio
async def test_employee_forbidden_to_create_project(
    client: AsyncClient,
    normal_user_token_headers: dict,
    normal_user: User
):
    """
    Суть проверяемого сценария и входные данные:
        Рядовой сотрудник (роль employee) пытается создать новый проект через
        POST /api/v1/admin/projects с валидным форматом кода проекта '2026-88883'.

    Какое корректное поведение ожидается:
        Сервер должен пресекать попытку несанкционированного изменения структуры компании
        и возвращать 403 Forbidden.
    """
    resp = await client.post(
        "/api/v1/admin/projects",
        json={
            "name": "Несанкционированный проект",
            "code": "2026-88883",
            "weekly_limit": 10,
            "manager_id": normal_user.id
        },
        headers=normal_user_token_headers
    )

    # Проверка защиты: Доступ к созданию проектов закрыт для сотрудников (403 Forbidden)
    assert resp.status_code == 403, (
        f"Ожидался статус 403 Forbidden, получен {resp.status_code}"
    )
