"""
Комплексный набор тестов стресс-тестирования, верификации дефектов и точек отказа (Breakage Attacks).

Набор тестов воспроизводит критические архитектурные и логические дефекты системы Overtime:
1. Атака 1: Серверный краш (HTTP 500 / AttributeError) при передаче несуществующего project_id при создании переработки.
2. Атака 2: BOLA / Несанкционированное согласование менеджером (согласование чужой заявки менеджером того же отдела, не являющимся руководителем).
3. Атака 3: Серверный краш (HTTP 500 / IntegrityError) при удалении пользователя со связанными заявками (отсутствие обработки IntegrityError в admin.py).
4. Атака 4: Серверный краш (HTTP 500 / IntegrityError) при попытке смены email пользователя на уже занятый другим пользователем (отсутствие 409 в admin_update_user).
5. Атака 5: Публичная утечка конфиденциальных голосовых записей сотрудников без авторизации (BOLA / Unauthenticated Data Leakage).
6. Атака 6: Манипуляция округлением и микросекундными переработками (Duration Rounding Exploitation).
"""

import os
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models.organization import Department, Project
from app.models.user import User, UserRole, UserCompany
from app.models.overtime import Overtime, OvertimeStatus
from app.core.security import hash_password, create_access_token
from app.core.rate_limit import overtime_create_limiter, admin_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    """Сбрасывает счетчики рейт-лимитеров перед каждым тестом."""
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()
    yield
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()


# =====================================================================
# АТАКА 1: Серверный краш (HTTP 500 / AttributeError) при несуществующем project_id
# =====================================================================

@pytest.mark.asyncio
async def test_attack_1_server_crash_500_invalid_project_id(
    client: AsyncClient,
    normal_user_token_headers: dict,
):
    """
    Атака 1: Серверный краш (HTTP 500 / AttributeError) при передаче несуществующего project_id при создании переработки.

    Вектор атаки:
        Клиент отправляет POST-запрос на /api/v1/overtimes/ с несуществующим идентификатором проекта (project_id: 999999).

    Механизм поломки:
        В `services/overtime.py` (строка 130) при обработке создания заявки происходит обращение к:
        `if ot_full.project.manager_id:`.
        Так как проект с ID 999999 отсутствует в базе данных, связь `ot_full.project` возвращает None.
        Попытка разыменования свойства `manager_id` у объекта None вызывает необработанное исключение:
        `AttributeError: 'NoneType' object has no attribute 'manager_id'`,
        что обрушивает выполнение запроса и приводит к HTTP 500 Internal Server Error.

    Ожидаемое корректное поведение:
        Сервер должен предварительно валидировать существование указанного `project_id` в базе данных
        и возвращать контролируемый статус 404 Not Found или 422 Unprocessable Entity с понятным сообщением об ошибке.

    Фактическая поломка:
        Сервер падает с необработанным исключением AttributeError (HTTP 500 Internal Server Error).
    """
    resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": 999999,
            "start_time": "2026-07-10T18:00:00",
            "end_time": "2026-07-10T20:00:00",
            "description": "Тестовая сверхурочная работа с несуществующим проектом",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )
    assert resp.status_code == 404, (
        f"Ожидался контролируемый статус 404 Not Found при несуществующем проекте, но получен {resp.status_code}: {resp.text}"
    )
    assert "не найден" in resp.text


# =====================================================================
# АТАКА 2: BOLA / Несанкционированное согласование менеджером
# =====================================================================

@pytest.mark.asyncio
async def test_attack_2_bola_unauthorized_review_by_same_department_manager(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    head_user: User,
    manager_user: User,
    test_project: Project,
    test_department: Department,
):
    """
    Атака 2: BOLA / Несанкционированное согласование руководителем (согласование чужой заявки менеджером того же отдела, не являющимся руководителем).

    Вектор атаки:
        Пользователь с руководящей ролью (UserRole.head), числящийся в том же отделе, но НЕ являющийся
        руководителем этого отдела (department.head_id) и НЕ являющийся менеджером проекта (project.manager_id),
        отправляет решение о согласовании чужой заявки через эндпоинт POST /api/v1/overtimes/{overtime_id}/review.

    Механизм поломки:
        В `services/overtime.py` (строки 241-262) проверка прав содержит критическую логическую уязвимость:
        `elif is_their_head or (overtime.user.department_id == current_user.department_id and current_user.role != UserRole.admin):`
        Условие совпадения отдела `overtime.user.department_id == current_user.department_id` истинно для любого
        руководителя данного отдела, даже если фактическим начальником подразделения назначен другой пользователь (`head_id`).
        Вследствие этого посторонний менеджер успешно утверждает чужую заявку со стороны Head, переводя ее в статус `APPROVED`.

    Ожидаемое корректное поведение:
        Сервер обязан проверить, является ли согласующий фактическим руководителем сотрудника (`dept.head_id == current_user.id`)
        или менеджером проекта (`project.manager_id == current_user.id`), и при несоответствии отклонить запрос
        со статусом 403 Forbidden ("Вы не являетесь ни начальником отдела этого сотрудника, ни менеджером проекта").

    Фактическая поломка:
        Сервер принимает решение от постороннего согласующего со статусом 200 OK
        и переводит заявку в финальный статус 'APPROVED'.
    """
    # 1. Привязываем проект к легитимному менеджеру (manager_user)
    test_project.manager_id = manager_user.id
    db_session.add(test_project)

    # 2. Убеждаемся, что легитимный начальник отдела — head_user
    test_department.head_id = head_user.id
    db_session.add(test_department)
    await db_session.commit()

    # 3. Сотрудник создает заявку на переработку
    ot_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": "2026-07-10T18:00:00",
            "end_time": "2026-07-10T20:00:00",
            "description": "Заявка сотрудника для верификации BOLA-уязвимости",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )
    assert ot_resp.status_code == 200, f"Ошибка создания заявки: {ot_resp.text}"
    overtime_id = ot_resp.json()["id"]

    # 4. Создаем второго руководителя в том же отделе (не head_id и не manager_id)
    rogue_head = User(
        full_name="Посторонний Руководитель Отдела",
        email="rogue_head@example.com",
        hashed_password=hash_password("rogue_pass123"),
        role=UserRole.head,
        company=UserCompany.Polymedia,
        department_id=test_department.id,
        is_active=True,
    )
    db_session.add(rogue_head)
    await db_session.commit()
    await db_session.refresh(rogue_head)

    rogue_token = create_access_token(data={"sub": str(rogue_head.id)})
    rogue_headers = {"Authorization": f"Bearer {rogue_token}"}

    # 5. Посторонний руководитель пытается согласовать чужую заявку
    review_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/review",
        json={
            "approved": True,
            "comment": "Нелегитимное согласование посторонним руководителем отдела",
        },
        headers=rogue_headers,
    )

    # Проверка защиты от BOLA: постороннему согласующему возвращается 403 Forbidden
    assert review_resp.status_code == 403, (
        f"Ожидалась блокировка (403 Forbidden), но получен {review_resp.status_code}: {review_resp.text}"
    )
    assert "не являетесь" in review_resp.text


# =====================================================================
# АТАКА 3: Серверный краш (HTTP 500 / IntegrityError) при удалении пользователя со связями
# =====================================================================

@pytest.mark.asyncio
async def test_attack_3_server_crash_500_delete_user_with_overtimes_integrity_error(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    test_project: Project,
    test_department: Department,
):
    """
    Атака 3: Серверный краш (HTTP 500 / IntegrityError) при удалении пользователя со связанными заявками (отсутствие обработки IntegrityError в admin.py).

    Вектор атаки:
        Администратор выполняет запрос DELETE /api/v1/admin/users/{user_id} в отношении пользователя,
        у которого в базе данных имеются зависимые записи переработок (`overtimes`).

    Механизм поломки:
        В `backend/app/api/v1/admin.py` в эндпоинте `delete_user` отсутствует блок `try...except IntegrityError`
        (в то время как в `delete_department` он предусмотрен). При включенной проверке внешних ключей
        база данных генерирует ошибку нарушения целостности связей (`FOREIGN KEY constraint failed`).
        Из-за отсутствия перехвата данного исключения сервер падает с кодом 500.

    Ожидаемое корректное поведение:
        Сервер должен перехватить `IntegrityError` и вернуть клиенту контролируемый статус 409 Conflict
        с информативным сообщением о невозможности удаления пользователя при наличии связанных данных.

    Фактическая поломка:
        Сервер выбрасывает необработанный IntegrityError (HTTP 500 Internal Server Error).
    """
    # Включаем контроль внешних ключей для SQLite сессии
    await db_session.execute(text("PRAGMA foreign_keys = ON;"))

    try:
        # 1. Создаем пользователя, подлежащего удалению
        user_to_delete = User(
            full_name="Сотрудник С Заявками",
            email="user_with_overtimes@example.com",
            hashed_password=hash_password("delete_pass123"),
            role=UserRole.employee,
            company=UserCompany.Polymedia,
            department_id=test_department.id,
            is_active=True,
        )
        db_session.add(user_to_delete)
        await db_session.commit()
        await db_session.refresh(user_to_delete)

        # 2. Создаем связанную заявку на переработку без каскадного удаления
        user_overtime = Overtime(
            user_id=user_to_delete.id,
            project_id=test_project.id,
            start_time=datetime(2026, 7, 10, 18, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 7, 10, 20, 0, tzinfo=timezone.utc),
            description="Сверхурочная работа пользователя",
            status=OvertimeStatus.PENDING,
        )
        db_session.add(user_overtime)
        await db_session.commit()

        # 3. Администратор пытается удалить пользователя
        resp = await client.delete(
            f"/api/v1/admin/users/{user_to_delete.id}",
            headers=admin_token_headers,
        )
        assert resp.status_code == 409, (
            f"Ожидался контролируемый статус 409 Conflict, но получен {resp.status_code}: {resp.text}"
        )
        assert "Невозможно удалить" in resp.text
    finally:
        # Выполняем rollback сессии и отключаем PRAGMA foreign_keys для чистоты последующих тестов
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys = OFF;"))


# =====================================================================
# АТАКА 4: Серверный краш (HTTP 500 / IntegrityError) при смене email на дублирующийся
# =====================================================================

@pytest.mark.asyncio
async def test_attack_4_server_crash_500_duplicate_email_in_admin_update_user(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    normal_user: User,
    test_department: Department,
):
    """
    Атака 4: Серверный краш (HTTP 500 / IntegrityError) при попытке смены email пользователя на уже занятый другим пользователем (отсутствие 409 в admin_update_user).

    Вектор атаки:
        Администратор пытается изменить email пользователя 1 на email пользователя 2
        через эндпоинт PATCH /api/v1/admin/users/{user_id}.

    Механизм поломки:
        В `backend/app/api/v1/admin.py` в функции `admin_update_user` отсутствует предварительная проверка
        существования email и отсутствует перехват `IntegrityError` при сохранении изменений в сессию.
        Нарушение UNIQUE-ограничения поля `users.email` порождает исключение `IntegrityError`, которое
        не перехватывается роутером и приводит к возврату HTTP 500 Internal Server Error.

    Ожидаемое корректное поведение:
        Сервер должен перехватить ошибку дубликата уникального поля и вернуть клиенту контролируемый
        статус 409 Conflict ("Пользователь с таким email уже существует").

    Фактическая поломка:
        Сервер выбрасывает необработанный IntegrityError (HTTP 500 Internal Server Error).
    """
    # 1. Создаем второго пользователя
    second_user = User(
        full_name="Второй Сотрудник",
        email="second_user_unique@example.com",
        hashed_password=hash_password("second_pass123"),
        role=UserRole.employee,
        company=UserCompany.Polymedia,
        department_id=test_department.id,
        is_active=True,
    )
    db_session.add(second_user)
    await db_session.commit()
    await db_session.refresh(second_user)

    resp = await client.patch(
        f"/api/v1/admin/users/{second_user.id}",
        json={
            "email": normal_user.email,
        },
        headers=admin_token_headers,
    )
    assert resp.status_code == 409, (
        f"Ожидался контролируемый статус 409 Conflict, но получен {resp.status_code}: {resp.text}"
    )
    assert "уже существует" in resp.text


# =====================================================================
# АТАКА 5: Публичная утечка голосовых записей без авторизации
# =====================================================================

@pytest.mark.asyncio
async def test_attack_5_unauthenticated_leakage_of_confidential_voice_records(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Атака 5: Публичная утечка конфиденциальных голосовых записей сотрудников без авторизации.
    Ожидается блокировка анонимного запроса (401 Unauthorized) и успешный доступ для авторизованного владельца.
    """
    # 1. Подготавливаем тестовый файл конфиденциальной голосовой записи
    uploads_voice_dir = os.path.abspath("uploads/voice")
    os.makedirs(uploads_voice_dir, exist_ok=True)
    test_leak_filename = "test_sensitive_voice_leak.txt"
    test_file_path = os.path.join(uploads_voice_dir, test_leak_filename)
    sensitive_content = "СЕКРЕТНАЯ_ГОЛОСОВАЯ_ЗАПИСЬ_СОТРУДНИКА_О_ПЕРЕРАБОТКЕ_12345"

    try:
        with open(test_file_path, "w", encoding="utf-8") as f:
            f.write(sensitive_content)

        # Привязываем файл к заявке normal_user (согласно принципу Default Deny)
        user_ot = Overtime(
            user_id=normal_user.id,
            project_id=test_project.id,
            start_time=datetime(2026, 7, 10, 18, 0),
            end_time=datetime(2026, 7, 10, 19, 0),
            description="Тестовая переработка с конфиденциальной записью",
            voice_url=f"uploads/voice/{test_leak_filename}",
            status=OvertimeStatus.APPROVED,
        )
        db_session.add(user_ot)
        await db_session.commit()

        # 2. Отправляем запрос без Authorization-заголовков (полностью анонимный запрос)
        unauth_resp = await client.get(f"/uploads/voice/{test_leak_filename}")

        # Проверка защиты: неавторизованный запрос блокируется статусом 401 Unauthorized
        assert unauth_resp.status_code == 401, (
            f"Ожидался статус 401 Unauthorized (защита от публичной утечки данных), "
            f"но получен {unauth_resp.status_code}: {unauth_resp.text}"
        )

        # 3. Аутентифицированный владелец получает доступ к своему файлу
        auth_resp = await client.get(
            f"/uploads/voice/{test_leak_filename}",
            headers=normal_user_token_headers
        )
        assert auth_resp.status_code == 200, (
            f"Ожидался статус 200 OK для авторизованного пользователя, но получен {auth_resp.status_code}"
        )
        assert auth_resp.text == sensitive_content
    finally:
        # Очищаем тестовый файл после проверки
        if os.path.exists(test_file_path):
            os.remove(test_file_path)


# =====================================================================
# АТАКА 6: Манипуляция округлением длительности переработки
# =====================================================================

@pytest.mark.asyncio
async def test_attack_6_duration_rounding_exploitation_1_second_equals_1_hour(
    client: AsyncClient,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Атака 6: Манипуляция округлением и микросекундными переработками (Duration Rounding Exploitation).
    Ожидается блокировка заявки длительностью менее 15 минут статусом 422 Unprocessable Entity.
    """
    resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": "2026-07-10T18:00:00",
            "end_time": "2026-07-10T18:00:01",
            "description": "Микросекундная работа: эксплуатация округления CEIL",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )

    # Проверка защиты: запрос с микросекундной переработкой (< 15 минут) отклоняется
    assert resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity для заявки длительностью 1 сек, но получен {resp.status_code}: {resp.text}"
    )
    assert "15 минут" in resp.text
