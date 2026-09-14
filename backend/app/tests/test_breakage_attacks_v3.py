"""
Комплексный набор тестов безопасности и архитектурной устойчивости (Breakage Attacks v3).

Настоящий модуль верифицирует устранение 7 архитектурных дефектов и уязвимостей Сессии 3:
1. Атака 1: Искажение корпоративной аналитики и бюджетов (CWE-840) — total_hours суммирует только APPROVED.
2. Атака 2: Обход авторизации на непривязанные файлы Fail-Open (CWE-276) — строгий Default Deny (403 Forbidden).
3. Атака 3: Серверный краш HTTP 500 при обновлении отдела с невалидным head_id (CWE-755) — возврат 404.
4. Атака 4: Серверный краш HTTP 500 при создании пользователя с несуществующим department_id (CWE-755) — возврат 404.
5. Атака 5: Бессмертные сессии при смене/сбросе пароля (CWE-613) — отзыв всех RefreshToken пользователя.
6. Атака 6: Временной перекос расчета недельных лимитов (Time Skew) — расчет недели от даты работы.
7. Атака 7: Самоблокировка и самопонижение администратора системы (CWE-284) — блокировка самодеактивации (400).
"""

import os
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from app.models.organization import Department, Project
from app.models.user import User, UserRole, UserCompany, RefreshToken
from app.models.overtime import Overtime, OvertimeStatus
from app.core.security import hash_password, create_access_token
from app.core.rate_limit import overtime_create_limiter, admin_limiter, login_limiter
from app.services.refresh_token import create_refresh_token


@pytest.fixture(autouse=True)
def reset_all_rate_limiters():
    """Сбрасывает счетчики рейт-лимитеров перед каждым тестом."""
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()
    login_limiter.attempts.clear()
    yield
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()
    login_limiter.attempts.clear()


# =====================================================================
# ТЕСТ 1: Искажение аналитики и бюджетов компании (CWE-840)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_1_analytics_total_hours_ignores_rejected_and_cancelled(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    normal_user: User,
    test_project: Project,
):
    """
    Атака 1: Проверка защиты от искажения корпоративной аналитики (CWE-840).

    Метрика total_hours в отчетах аналитики должна суммировать исключительно согласованные
    переработки (OvertimeStatus.APPROVED). Часы отклоненных (REJECTED), отмененных (CANCELLED)
    и ожидающих (PENDING) заявок не должны попадать в total_hours.
    """
    base_time = datetime(2026, 7, 10, 10, 0, tzinfo=timezone.utc)

    # 1. Создаем 1 согласованную переработку на 2 часа
    approved_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=base_time,
        end_time=base_time + timedelta(hours=2),
        description="Согласованная работа",
        status=OvertimeStatus.APPROVED,
        approved_hours=2,
    )
    # 2. Создаем отклоненную переработку на 10 часов
    rejected_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=base_time + timedelta(days=1),
        end_time=base_time + timedelta(days=1, hours=10),
        description="Отклоненная заявка",
        status=OvertimeStatus.REJECTED,
        manager_approved=False,
    )
    # 3. Создаем отмененную заявку на 5 часов
    cancelled_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=base_time + timedelta(days=2),
        end_time=base_time + timedelta(days=2, hours=5),
        description="Отмененная заявка",
        status=OvertimeStatus.CANCELLED,
    )
    # 4. Создаем заявку в ожидании согласования на 3 часа
    pending_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=base_time + timedelta(days=3),
        end_time=base_time + timedelta(days=3, hours=3),
        description="Заявка на согласовании",
        status=OvertimeStatus.PENDING,
    )

    db_session.add_all([approved_ot, rejected_ot, cancelled_ot, pending_ot])
    await db_session.commit()

    # Запрашиваем сводную аналитику
    resp = await client.get("/api/v1/analytics/summary", headers=admin_token_headers)
    assert resp.status_code == 200, f"Ошибка получения аналитики: {resp.text}"
    data = resp.json()

    # Защита подтверждена: total_hours учитывает только 2 согласованных часа, а не 20!
    assert data["total_hours"] == 2.0, (
        f"Ожидалось 2.0 часа согласованных переработок, но получено {data['total_hours']} "
        f"(отклоненные/отмененные часы исказили аналитику!)"
    )
    assert data["approved_requests"] == 1
    assert data["rejected_requests"] == 1
    assert data["pending_requests"] == 1
    assert data["total_requests"] == 4


# =====================================================================
# ТЕСТ 2: Защита Default Deny на непривязанные файлы (CWE-276)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_2_fail_open_unlinked_file_blocked_by_default_deny(
    client: AsyncClient,
    normal_user_token_headers: dict,
    admin_token_headers: dict,
):
    """
    Атака 2: Защита от утечки непривязанных/системных файлов (Default Deny, CWE-276).

    Если файл существует на диске, но не привязан ни к одной заявке в БД:
    - Обычному авторизованному пользователю доступ строго запрещен (HTTP 403 Forbidden).
    - Только системный администратор имеет право доступа (HTTP 200 OK).
    """
    uploads_base = os.path.abspath("uploads")
    voice_dir = os.path.join(uploads_base, "voice")
    os.makedirs(voice_dir, exist_ok=True)
    unlinked_filename = "unlinked_orphan_secret_audio.ogg"
    unlinked_filepath = os.path.join(voice_dir, unlinked_filename)
    secret_bytes = b"ORPHAN_UNLINKED_FILE_DATA_CONFIDENTIAL"

    with open(unlinked_filepath, "wb") as f:
        f.write(secret_bytes)

    try:
        # 1. Рядовой сотрудник запрашивает непривязанный файл
        user_resp = await client.get(
            f"/uploads/voice/{unlinked_filename}",
            headers=normal_user_token_headers,
        )
        # Защита подтверждена: Default Deny блокирует запрос со статусом 403 Forbidden
        assert user_resp.status_code == 403, (
            f"Ожидался статус 403 Forbidden (Default Deny), но получен {user_resp.status_code}: {user_resp.text}"
        )
        assert "У вас нет прав" in user_resp.json()["detail"]

        # 2. Администратор системы может скачать непривязанный файл
        admin_resp = await client.get(
            f"/uploads/voice/{unlinked_filename}",
            headers=admin_token_headers,
        )
        assert admin_resp.status_code == 200
        assert admin_resp.content == secret_bytes

    finally:
        if os.path.exists(unlinked_filepath):
            os.remove(unlinked_filepath)


# =====================================================================
# ТЕСТ 3: Защита от краша 500 при обновлении отдела (CWE-755)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_3_update_department_invalid_head_id_and_integrity_error(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    test_department: Department,
    manager_user: User,
):
    """
    Атака 3: Защита от падения 500 при обновлении отдела (CWE-755).

    - При передаче несуществующего head_id возвращается контролируемый статус 404 Not Found.
    - При передаче валидного head_id отдел успешно обновляется со статусом 200 OK.
    """
    await db_session.execute(text("PRAGMA foreign_keys = ON;"))

    try:
        # 1. Попытка назначения несуществующего руководителя отдела (head_id: 999999)
        patch_invalid = await client.patch(
            f"/api/v1/admin/departments/{test_department.id}",
            json={"head_id": 999999},
            headers=admin_token_headers,
        )
        # Защита: сервер не падает с 500, а возвращает 404
        assert patch_invalid.status_code == 404, (
            f"Ожидался статус 404 Not Found при невалидном head_id, но получен {patch_invalid.status_code}: {patch_invalid.text}"
        )
        assert "не найден" in patch_invalid.json()["detail"]

        # 2. Успешное обновление с легитимным пользователем
        patch_valid = await client.patch(
            f"/api/v1/admin/departments/{test_department.id}",
            json={"head_id": manager_user.id},
            headers=admin_token_headers,
        )
        assert patch_valid.status_code == 200
        assert patch_valid.json()["head_id"] == manager_user.id

    finally:
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys = OFF;"))


# =====================================================================
# ТЕСТ 4: Валидация department_id при создании пользователя (CWE-755)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_4_create_user_with_invalid_department_id_returns_404(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
):
    """
    Атака 4: Защита от краша 500 при создании пользователя с невалидным department_id (CWE-755).

    Сервер должен возвращать HTTP 404 Not Found при передаче несуществующего department_id,
    а не падать с необработанным IntegrityError (FOREIGN KEY constraint failed).
    """
    await db_session.execute(text("PRAGMA foreign_keys = ON;"))

    try:
        resp = await client.post(
            "/api/v1/admin/users",
            json={
                "email": "user_with_invalid_dept@example.com",
                "full_name": "Тестовый Пользователь",
                "password": "Password123!",
                "department_id": 999999,
                "role": "employee",
                "company": "Polymedia",
            },
            headers=admin_token_headers,
        )
        # Защита подтверждена: вместо серверного краша 500 возвращается 404
        assert resp.status_code == 404, (
            f"Ожидался статус 404 Not Found при несуществующем отделе, но получен {resp.status_code}: {resp.text}"
        )
        assert "Отдел с ID 999999 не найден" in resp.json()["detail"]

    finally:
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys = OFF;"))


# =====================================================================
# ТЕСТ 5: Отзыв всех RefreshToken при смене/сбросе пароля (CWE-613)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_5_password_change_and_reset_revokes_all_refresh_tokens(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    admin_token_headers: dict,
):
    """
    Атака 5: Защита от бессмертных сессий злоумышленника при смене пароля (CWE-613).

    При смене пароля пользователем или администратором ВСЕ выданные refresh-токены
    должны немедленно аннулироваться (revoked = True).
    """
    # 1. Создаем несколько активных refresh-токенов для пользователя
    token_1 = await create_refresh_token(db_session, normal_user.id)
    token_2 = await create_refresh_token(db_session, normal_user.id)
    await db_session.commit()

    # Проверяем, что оба токена активны
    tokens_stmt = select(RefreshToken).where(
        RefreshToken.user_id == normal_user.id,
        RefreshToken.revoked == False,
    )
    active_tokens = (await db_session.execute(tokens_stmt)).scalars().all()
    assert len(active_tokens) >= 2

    # 2. Пользователь меняет пароль
    change_resp = await client.post(
        "/api/v1/auth/change-password",
        json={
            "old_password": "user_pass",
            "new_password": "NewSecurePassword123!",
        },
        headers=normal_user_token_headers,
    )
    assert change_resp.status_code == 200

    # 3. Проверяем в БД: все старые refresh-токены должны быть отозваны (revoked = True)
    active_after = (await db_session.execute(tokens_stmt)).scalars().all()
    assert len(active_after) == 0, (
        f"Уязвимость подтверждена: после смены пароля осталось {len(active_after)} активных refresh-токенов!"
    )

    # 4. Проверяем отзыв при административном сбросе пароля
    token_3 = await create_refresh_token(db_session, normal_user.id)
    await db_session.commit()

    admin_reset_resp = await client.post(
        f"/api/v1/admin/users/{normal_user.id}/reset-password",
        headers=admin_token_headers,
    )
    assert admin_reset_resp.status_code == 200

    active_after_reset = (await db_session.execute(tokens_stmt)).scalars().all()
    assert len(active_after_reset) == 0, (
        "Уязвимость подтверждена: админский сброс пароля не отозвал refresh-токены!"
    )


# =====================================================================
# ТЕСТ 6: Устранение Time Skew при расчете недельных лимитов
# =====================================================================

@pytest.mark.asyncio
async def test_attack_6_time_skew_weekly_overtime_limit_evaluation(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    manager_user: User,
    head_user: User,
    head_token_headers: dict,
    test_project: Project,
    test_department: Department,
):
    """
    Атака 6: Защита от обхода недельных лимитов через подачу переработок за прошлую неделю (Time Skew).

    Если сотрудник отработал 45 часов на прошлой неделе при лимите проекта 40 часов,
    согласование заявки начальником отдела не должно переводить заявку сразу в APPROVED:
    из-за превышения лимита за целевую неделю заявка должна перейти в статус HEAD_APPROVED,
    требуя визы менеджера проекта.
    """
    test_project.manager_id = manager_user.id
    test_project.weekly_limit = 40
    test_department.head_id = head_user.id
    normal_user.department_id = test_department.id
    db_session.add_all([test_project, test_department, normal_user])
    await db_session.commit()

    # Дата 2 недели назад (понедельник 18:00)
    past_date = datetime.now(timezone.utc) - timedelta(days=14)
    past_monday = (past_date - timedelta(days=past_date.weekday())).replace(hour=18, minute=0, second=0, microsecond=0)

    # 1. Заполняем лимит на прошлой неделе: создаем заявку на 38 часов
    prev_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=past_monday,
        end_time=past_monday + timedelta(hours=38),
        description="Переработка 38 часов за прошлую неделю",
        status=OvertimeStatus.APPROVED,
        approved_hours=38,
    )
    db_session.add(prev_ot)
    await db_session.commit()

    # 2. Создаем новую заявку на ту же прошлую неделю (среда) на 10 часов (итого 48 > лимит 40)
    new_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=past_monday + timedelta(days=2),
        end_time=past_monday + timedelta(days=2, hours=10),
        description="Переработка 10 часов за ту же неделю",
        status=OvertimeStatus.PENDING,
    )
    db_session.add(new_ot)
    await db_session.commit()
    await db_session.refresh(new_ot)

    # 3. Начальник отдела (Head) согласует заявку
    review_resp = await client.post(
        f"/api/v1/overtimes/{new_ot.id}/review",
        json={"approved": True, "comment": "Согласовано начальником отдела"},
        headers=head_token_headers,
    )
    assert review_resp.status_code == 200

    # Защита подтверждена: система рассчитала часы именно по целевой неделе (38 + 10 = 48 > 40),
    # поэтому заявка перешла в HEAD_APPROVED, а не в APPROVED!
    review_data = review_resp.json()
    assert review_data["status"] == OvertimeStatus.HEAD_APPROVED.value, (
        f"Ожидался статус HEAD_APPROVED из-за превышения лимита прошлой недели (48ч > 40ч), "
        f"но получен '{review_data['status']}' (Time Skew ошибка расчёта)!"
    )


# =====================================================================
# ТЕСТ 7: Защита от самоблокировки и самопонижения администратора (CWE-284)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_7_admin_self_lockout_and_demotion_prevention(
    client: AsyncClient,
    admin_user: User,
    admin_token_headers: dict,
):
    """
    Атака 7: Защита от самоблокировки и самопонижения администратора (CWE-284).

    Администратор системы не может случайно или злонамеренно:
    - Деактивировать свою собственную учетную запись (is_active = False $\rightarrow$ HTTP 400).
    - Понизить свою роль (role = employee $\rightarrow$ HTTP 400).
    """
    # 1. Попытка деактивации своей собственной учетной записи
    deactivate_resp = await client.patch(
        f"/api/v1/admin/users/{admin_user.id}",
        json={"is_active": False},
        headers=admin_token_headers,
    )
    # Защита подтверждена: запрос заблокирован со статусом 400
    assert deactivate_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request при самодеактивации, но получен {deactivate_resp.status_code}: {deactivate_resp.text}"
    )
    assert "не можете деактивировать" in deactivate_resp.json()["detail"]

    # 2. Попытка снять с себя роль администратора
    demote_resp = await client.patch(
        f"/api/v1/admin/users/{admin_user.id}",
        json={"role": "employee"},
        headers=admin_token_headers,
    )
    # Защита подтверждена: запрос заблокирован со статусом 400
    assert demote_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request при самопонижении роли, но получен {demote_resp.status_code}: {demote_resp.text}"
    )
    assert "не можете снять с себя роль администратора" in demote_resp.json()["detail"]
