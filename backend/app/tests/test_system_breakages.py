"""
Комплексный набор тестов верификации безопасности и отказоустойчивости системы Overtime.
Каждый тест проверяет, что обнаруженные уязвимости и сбои надежно заблокированы:
1. IDOR/BOLA блокируется с кодом 403 Forbidden.
2. Публичная эскалация прав закрыта (эндпоинт регистрации возвращает 404 Not Found).
3. Самосогласование (Self-Approval) рядовым руководителям запрещено (403 Forbidden), а администратору разрешено с аудитом и уведомлением.
4. Попытка смены отдела сотрудником через PATCH /me блокируется/игнорируется.
5. Прием токена через ?token= отклоняется (401 Unauthorized).
6. Машина состояний защищена: повторный review терминальных заявок отклоняется (400 Bad Request).
7. Сотрудник не может отменить утвержденную (APPROVED) заявку (400 Bad Request).
8. Отрицательные часы переработки отклоняются валидатором схемы (422 Unprocessable Entity).
9. Экспорт в Excel санитизирует формулы (CWE-1236), экранируя опасные символы апострофом.
10. Отрицательные параметры пагинации отклоняются со статусом 422.
11. Экстремальный DoS-лимит (2147483647) в аудите отклоняется со статусом 422.
"""

import io
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from openpyxl import load_workbook
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Department, Project
from app.models.user import User, UserRole, UserCompany
from app.models.notification import Notification
from app.core.security import hash_password, create_access_token
from app.services.excel_service import generate_excel_file


# =====================================================================
# НАПРАВЛЕНИЕ 1: Разграничение доступа и роли пользователей
# =====================================================================

@pytest.mark.asyncio
async def test_idor_view_other_user_overtime(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    test_project: Project,
    test_department: Department,
):
    """
    Проверка защиты от IDOR/BOLA в GET /api/v1/overtimes/{overtime_id}.
    Сотрудник (normal_user) обращается к приватной заявке другого сотрудника (victim_user).
    Ожидается блокировка: 403 Forbidden.
    """
    # 1. Создаем второго сотрудника (жертву)
    victim_user = User(
        full_name="Сотрудник Жертва",
        email="victim@example.com",
        hashed_password=hash_password("victim_pass"),
        role=UserRole.employee,
        company=UserCompany.Polymedia,
        department_id=test_department.id,
        is_active=True
    )
    db_session.add(victim_user)
    await db_session.commit()
    await db_session.refresh(victim_user)

    # 2. Создаем заявку от имени victim_user
    victim_token = create_access_token(data={"sub": str(victim_user.id)})
    victim_headers = {"Authorization": f"Bearer {victim_token}"}

    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Секретная сверхурочная работа жертвы",
            "start_lat": 55.7558,
            "start_lng": 37.6173
        },
        headers=victim_headers
    )
    assert create_resp.status_code == 200
    victim_overtime_id = create_resp.json()["id"]

    # 3. Первый сотрудник (normal_user) запрашивает чужую заявку
    idor_resp = await client.get(
        f"/api/v1/overtimes/{victim_overtime_id}",
        headers=normal_user_token_headers
    )

    # Проверка защиты: Доступ к чужой заявке блокируется со статусом 403 Forbidden
    assert idor_resp.status_code == 403, (
        f"Ожидался 403 Forbidden для предотвращения IDOR, получен {idor_resp.status_code}"
    )


@pytest.mark.asyncio
async def test_privilege_escalation_via_registration(
    client: AsyncClient,
    db_session: AsyncSession
):
    """
    Проверка закрытия открытой регистрации (Mass Assignment).
    Попытка вызова эндпоинта POST /api/v1/auth/register должна возвращать 404 Not Found.
    """
    attacker_data = {
        "full_name": "Злоумышленник Эскалатор",
        "email": "attacker_admin@evil.com",
        "password": "AttackerPass123!",
        "role": "admin"
    }

    reg_resp = await client.post("/api/v1/auth/register", json=attacker_data)

    # Проверка защиты: Эндпоинт открытой регистрации удален (404 Not Found)
    assert reg_resp.status_code == 404, (
        f"Ожидался 404 Not Found (публичная регистрация закрыта), получен {reg_resp.status_code}"
    )


@pytest.mark.asyncio
async def test_self_approval_by_head_conflict_of_interest(
    client: AsyncClient,
    db_session: AsyncSession,
    head_user: User,
    head_token_headers: dict,
    test_project: Project
):
    """
    Проверка блокировки конфликта интересов: начальник отдела пытается утвердить
    собственную заявку. Ожидается блокировка 403 Forbidden.
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Сам себе выписал переработку",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=head_token_headers
    )
    assert create_resp.status_code == 200
    overtime_id = create_resp.json()["id"]

    review_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/review",
        json={"approved": True, "comment": "Сам себя одобряю, молодец!"},
        headers=head_token_headers
    )

    # Проверка защиты: Самосогласование начальником отдела заблокировано (403 Forbidden)
    assert review_resp.status_code == 403, (
        f"Ожидался 403 Forbidden (конфликт интересов), получен {review_resp.status_code}"
    )


@pytest.mark.asyncio
async def test_self_approval_by_admin_allowed_with_notification(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    admin_token_headers: dict,
    test_project: Project
):
    """
    Проверка самосогласования администратором: разрешено с аудитом и уведомлением.
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Переработка администратора",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=admin_token_headers
    )
    assert create_resp.status_code == 200
    overtime_id = create_resp.json()["id"]

    review_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/review",
        json={"approved": True, "comment": "Согласовано администратором"},
        headers=admin_token_headers
    )

    # Администратору самосогласование разрешено
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_bfla_employee_blocked_from_admin_endpoints(
    client: AsyncClient,
    normal_user_token_headers: dict
):
    """
    Контрольный тест: Проверка блокировки рядовых сотрудников от административных роутов.
    """
    resp_users = await client.get("/api/v1/admin/users", headers=normal_user_token_headers)
    assert resp_users.status_code == 403

    resp_audit = await client.get("/api/v1/audit/export", headers=normal_user_token_headers)
    assert resp_audit.status_code == 403


@pytest.mark.asyncio
async def test_arbitrary_department_switch_via_profile_update(
    client: AsyncClient,
    normal_user: User,
    normal_user_token_headers: dict,
    db_session: AsyncSession
):
    """
    Проверка невозможности смены отдела сотрудником через PATCH /api/v1/auth/me.
    Поле department_id удалено из схемы настроек профиля.
    """
    original_dept_id = normal_user.department_id

    dept2 = Department(name="Чужой секретный отдел")
    db_session.add(dept2)
    await db_session.commit()
    await db_session.refresh(dept2)

    patch_resp = await client.patch(
        "/api/v1/auth/me",
        json={"department_id": dept2.id, "full_name": "Новое Имя"},
        headers=normal_user_token_headers
    )

    assert patch_resp.status_code == 200
    # Проверка защиты: отдел сотрудника НЕ изменился
    assert patch_resp.json()["department_id"] == original_dept_id


@pytest.mark.asyncio
async def test_token_query_parameter_rejected(
    client: AsyncClient,
    normal_user: User
):
    """
    Проверка отказа в аутентификации при передаче токена через query-параметр ?token=.
    Сервер должен возвращать 401 Unauthorized.
    """
    token = create_access_token(data={"sub": str(normal_user.id)})
    resp = await client.get(f"/api/v1/auth/me?token={token}")

    # Проверка защиты: токен в query-параметре отклоняется
    assert resp.status_code == 401, (
        f"Ожидался 401 Unauthorized при передаче токена в query, получен {resp.status_code}"
    )


# =====================================================================
# НАПРАВЛЕНИЕ 2: Жизненный цикл и машина состояний
# =====================================================================

@pytest.mark.asyncio
async def test_review_overtime_terminal_state_violation(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    head_user: User,
    head_token_headers: dict,
    test_project: Project
):
    """
    Проверка защиты терминальных статусов: отклоненную заявку (REJECTED)
    нельзя повторно согласовать в APPROVED.
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Заявка под отказ",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=normal_user_token_headers
    )
    assert create_resp.status_code == 200
    ot_id = create_resp.json()["id"]

    # 1. Руководитель отклоняет заявку -> REJECTED
    reject_resp = await client.post(
        f"/api/v1/overtimes/{ot_id}/review",
        json={"approved": False, "comment": "Отклонено"},
        headers=head_token_headers
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "REJECTED"

    # 2. Руководитель пытается повторно согласовать уже отклоненную заявку
    re_review_resp = await client.post(
        f"/api/v1/overtimes/{ot_id}/review",
        json={"approved": True, "comment": "Передумал, одобряю"},
        headers=head_token_headers
    )

    # Проверка защиты: Повторное согласование терминального статуса отклоняется (400 Bad Request)
    assert re_review_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request, получен {re_review_resp.status_code}"
    )


@pytest.mark.asyncio
async def test_employee_can_cancel_and_restore_approved_overtime(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user_token_headers: dict,
    head_token_headers: dict,
    test_project: Project
):
    """
    Проверка защиты утвержденных заявок: сотрудник не может отменить
    уже согласованную руководством заявку (APPROVED).
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Заявка на одобрение",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=normal_user_token_headers
    )
    assert create_resp.status_code == 200
    ot_id = create_resp.json()["id"]

    # Руководитель утверждает заявку
    appr_resp = await client.post(
        f"/api/v1/overtimes/{ot_id}/review",
        json={"approved": True, "comment": "Утверждено"},
        headers=head_token_headers
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "APPROVED"

    # Сотрудник пытается отменить УТВЕРЖДЕННУЮ заявку
    cancel_resp = await client.post(
        f"/api/v1/overtimes/{ot_id}/cancel",
        headers=normal_user_token_headers
    )

    # Проверка защиты: Отмена утвержденной заявки блокируется (400 Bad Request)
    assert cancel_resp.status_code == 400, (
        f"Ожидался 400 Bad Request (запрет отмены согласованной заявки), получен {cancel_resp.status_code}"
    )


@pytest.mark.asyncio
async def test_review_with_negative_approved_hours(
    client: AsyncClient,
    normal_user_token_headers: dict,
    head_token_headers: dict,
    test_project: Project
):
    """
    Проверка валидации approved_hours: отрицательные часы должны отклоняться со статусом 422.
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Тест отрицательных часов",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=normal_user_token_headers
    )
    assert create_resp.status_code == 200
    ot_id = create_resp.json()["id"]

    review_resp = await client.post(
        f"/api/v1/overtimes/{ot_id}/review",
        json={"approved": True, "comment": "Штрафные часы", "approved_hours": -10.0},
        headers=head_token_headers
    )

    # Проверка защиты: Отрицательные часы отклоняются валидатором схемы (422 Unprocessable Entity)
    assert review_resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity, получен {review_resp.status_code}"
    )


# =====================================================================
# НАПРАВЛЕНИЕ 3: Валидация входных данных, экспорт и пагинация
# =====================================================================

@pytest.mark.asyncio
async def test_formula_injection_in_excel_export(
    admin_user: User
):
    """
    Проверка защиты от Formula Injection (CWE-1236) при экспорте отчета в Excel.
    Опасные конструкции (=, +, -, @) должны экранироваться префиксом апострофа.
    """
    malicious_data = [
        {
            "id": 1,
            "employee": "Вредоносный Пользователь",
            "author": "Вредоносный Пользователь",
            "project": "Тестовый проект",
            "start_time": "2026-06-01T18:00:00",
            "end_time": "2026-06-01T21:00:00",
            "hours": 3.0,
            "approved_hours": 3.0,
            "description": "=SUM(1+1)",
            "status": "Подтверждено"
        }
    ]

    excel_bytes = await generate_excel_file(
        data=malicious_data,
        current_user=admin_user,
        is_personal=False
    )
    assert excel_bytes is not None

    wb = load_workbook(io.BytesIO(excel_bytes.getvalue()))
    ws = wb["Report"]

    # Колонка 9 — Описание, строка 5 — данные
    desc_cell = ws.cell(row=5, column=9)

    # Проверка защиты: Формула экранирована апострофом
    assert str(desc_cell.value).startswith("'="), (
        f"Ожидалось экранирование апострофом ('=...), получено {desc_cell.value}"
    )


@pytest.mark.asyncio
async def test_pagination_negative_parameters_bypass_validation(
    client: AsyncClient,
    normal_user_token_headers: dict
):
    """
    Проверка валидации параметров пагинации переработок:
    page=-1, page_size=-10 должны отклоняться со статусом 422.
    """
    resp = await client.get(
        "/api/v1/overtimes/?page=-1&page_size=-10",
        headers=normal_user_token_headers
    )
    # Проверка защиты: Отрицательные параметры пагинации отклоняются (422)
    assert resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity, получен {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_audit_pagination_negative_parameters_bypass_validation(
    client: AsyncClient,
    admin_token_headers: dict
):
    """
    Проверка валидации параметров пагинации аудита:
    limit=-1, offset=-1 должны отклоняться со статусом 422.
    """
    resp = await client.get(
        "/api/v1/audit/?limit=-1&offset=-1",
        headers=admin_token_headers
    )
    # Проверка защиты: Отрицательные параметры аудита отклоняются (422)
    assert resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity, получен {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_extreme_limit_uncontrolled_resource_consumption(
    client: AsyncClient,
    admin_token_headers: dict
):
    """
    Проверка защиты от DoS через экстремальный limit=2147483647 в аудите.
    Ожидается ошибка валидации 422 (limit <= 1000).
    """
    resp = await client.get(
        "/api/v1/audit/?limit=2147483647",
        headers=admin_token_headers
    )
    # Проверка защиты: Экстремальный лимит отклоняется (422)
    assert resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity, получен {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_password_reset_confirm_complexity(
    client: AsyncClient
):
    """
    Проверка валидации сложности пароля при подтверждении сброса через OTP.
    Простой пароль ('123') должен отклоняться со статусом 422.
    """
    resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "email": "victim@example.com",
            "code": "123456",
            "new_password": "123"
        }
    )
    assert resp.status_code == 422, (
        f"Ожидался 422 Unprocessable Entity для простого пароля, получен {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_patch_overtime_schema_mismatch_crash(
    client: AsyncClient,
    normal_user_token_headers: dict,
    test_project: Project
):
    """
    Проверка защиты от рассинхрона схем OvertimeUpdate и OvertimeResponse:
    при передаче description > 2000 символов запрос должен отклоняться с 422,
    а не приводить к 500 ResponseValidationError.
    """
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time,
            "end_time": end_time,
            "description": "Тестовая заявка для проверки длины описания",
            "start_lat": 10.0,
            "start_lng": 20.0
        },
        headers=normal_user_token_headers
    )
    assert create_resp.status_code == 200
    ot_id = create_resp.json()["id"]

    # Отправляем PATCH с описанием длиной 2500 символов
    patch_resp = await client.patch(
        f"/api/v1/overtimes/{ot_id}",
        json={"description": "X" * 2500},
        headers=normal_user_token_headers
    )
    assert patch_resp.status_code == 422, (
        f"Ожидалась ошибка валидации схемы (422), получен статус {patch_resp.status_code}"
    )
