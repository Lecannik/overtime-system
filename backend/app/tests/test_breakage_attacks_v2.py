"""
Комплексный набор тестов безопасности и валидации точек отказа (Breakage Attacks v2).

Настоящий модуль проверяет устранение 6 критических уязвимостей и точек отказа в системе:
1. Атака 1: Защита от сброса визы отклонения и восстановления заявки сотрудником (State Machine Bypass).
2. Атака 2: Защита от BOLA / IDOR в хранилище файлов (запрет доступа к чужим голосовым записям).
3. Атака 3: Контроль минимального порога длительности (15 минут) при частичном обновлении через PATCH.
4. Атака 4: Запрет привязки заявки к неактивному/архивному проекту через PATCH.
5. Атака 5: Защита от IntegrityError/500 при создании отдела с невалидным head_id или дубликатом.
6. Атака 6: Запрет модификации корпоративного weekly_limit проекта менеджером (только admin).
"""

import os
from datetime import datetime
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.models.organization import Department, Project
from app.models.user import User, UserRole, UserCompany
from app.models.overtime import Overtime, OvertimeStatus
from app.core.security import hash_password, create_access_token
from app.core.rate_limit import overtime_create_limiter, admin_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    """
    Сбрасывает счетчики рейт-лимитеров перед каждым тестом.
    Гарантирует изоляцию тестов от блокировок лимитера запросов.
    """
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()
    yield
    overtime_create_limiter.attempts.clear()
    admin_limiter.attempts.clear()


# =====================================================================
# АТАКА 1: Защита конечного автомата (State Machine) от воскрешения
# =====================================================================

@pytest.mark.asyncio
async def test_attack_1_rejection_resurrection_state_machine_bypass(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user_token_headers: dict,
    manager_user: User,
    manager_token_headers: dict,
    test_project: Project,
):
    """
    Атака 1: Проверка защиты от сброса визы отклонения и воскрешения отклоненной заявки.

    Ожидаемое защитное поведение:
        1. Руководитель отклоняет заявку (статус REJECTED, manager_approved = False).
        2. Рядовому сотруднику запрещено отменять отклоненную заявку: POST /cancel возвращает HTTP 400.
        3. Даже если заявка переведена в отмененные, восстановление (POST /restore) запрещено:
           сервер возвращает HTTP 400, сохраняя историю решения руководства.
    """
    # 0. Назначаем менеджера для тестового проекта
    test_project.manager_id = manager_user.id
    db_session.add(test_project)
    await db_session.commit()
    await db_session.refresh(test_project)

    # 1. Сотрудник создает заявку на переработку
    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": "2026-07-10T18:00:00",
            "end_time": "2026-07-10T20:00:00",
            "description": "Сверхурочная работа, подлежащая отклонению",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )
    assert create_resp.status_code == 200, f"Не удалось создать заявку: {create_resp.text}"
    overtime_id = create_resp.json()["id"]

    # 2. Менеджер проекта отклоняет заявку
    reject_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/review",
        json={
            "approved": False,
            "comment": "Отклонено: работы не были согласованы заранее",
        },
        headers=manager_token_headers,
    )
    assert reject_resp.status_code == 200, f"Ошибка согласования: {reject_resp.text}"
    assert reject_resp.json()["status"] == OvertimeStatus.REJECTED.value
    assert reject_resp.json()["manager_approved"] is False

    # 3. Сотрудник пытается отменить отклоненную заявку (POST /cancel)
    cancel_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/cancel",
        headers=normal_user_token_headers,
    )
    # Защита: отмена отклоненной заявки заблокирована (HTTP 400)
    assert cancel_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request при отмене отклоненной заявки, но получен {cancel_resp.status_code}: {cancel_resp.text}"
    )
    assert "Нельзя отменить уже отклоненную заявку" in cancel_resp.json()["detail"]

    # 4. Проверяем, что статус заявки остался REJECTED
    check_resp = await client.get(
        f"/api/v1/overtimes/{overtime_id}",
        headers=normal_user_token_headers,
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["status"] == OvertimeStatus.REJECTED.value
    assert check_resp.json()["manager_approved"] is False

    # 5. Проверяем защиту эндпоинта /restore: если заявка была отклонена руководством, ее нельзя восстановить
    overtime_obj = await db_session.get(Overtime, overtime_id)
    assert overtime_obj is not None
    overtime_obj.status = OvertimeStatus.CANCELLED
    await db_session.commit()

    restore_resp = await client.post(
        f"/api/v1/overtimes/{overtime_id}/restore",
        headers=normal_user_token_headers,
    )
    assert restore_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request при попытке восстановления обработанной заявки, но получен {restore_resp.status_code}"
    )
    assert "решение по которой уже было принято руководством" in restore_resp.json()["detail"]


# =====================================================================
# АТАКА 2: Защита BOLA / IDOR в хранилище приватных файлов
# =====================================================================

@pytest.mark.asyncio
async def test_attack_2_bola_idor_unauthorized_download_of_foreign_voice_recording(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    admin_token_headers: dict,
    test_project: Project,
    test_department: Department,
):
    """
    Атака 2: Защита приватных аудиозаписей сотрудников от несанкционированного скачивания (BOLA / IDOR).

    Ожидаемое защитное поведение:
        - Посторонний сотрудник B при запросе приватного аудиофайла сотрудника A получает HTTP 403 Forbidden.
        - Автор файла (сотрудник A) и администратор имеют беспрепятственный доступ (HTTP 200 OK).
    """
    # 1. Создаем приватную голосовую запись сотрудника A на диске
    uploads_base = os.path.abspath("uploads")
    voice_dir = os.path.join(uploads_base, "voice")
    os.makedirs(voice_dir, exist_ok=True)
    secret_filename = "victim_employee_a_confidential_voice.ogg"
    secret_filepath = os.path.join(voice_dir, secret_filename)
    secret_content = b"OggS_CONFIDENTIAL_AUDIO_RECORDING_OF_EMPLOYEE_A_SECRET_DISCUSSIONS"

    with open(secret_filepath, "wb") as f:
        f.write(secret_content)

    try:
        # 2. Создаем заявку сотрудника A в БД, привязанную к этому файлу
        victim_overtime = Overtime(
            user_id=normal_user.id,
            project_id=test_project.id,
            start_time=datetime(2026, 7, 10, 18, 0),
            end_time=datetime(2026, 7, 10, 19, 0),
            description="Заявка с конфиденциальной голосовой записью",
            voice_url=f"uploads/voice/{secret_filename}",
            status=OvertimeStatus.APPROVED,
        )
        db_session.add(victim_overtime)
        await db_session.commit()
        await db_session.refresh(victim_overtime)

        # 3. Создаем стороннего сотрудника B (атакующего)
        attacker_user = User(
            full_name="Сторонний Сотрудник B",
            email="attacker_employee_b@example.com",
            hashed_password=hash_password("attacker_pass123"),
            role=UserRole.employee,
            company=UserCompany.Polymedia,
            department_id=test_department.id,
            is_active=True,
        )
        db_session.add(attacker_user)
        await db_session.commit()
        await db_session.refresh(attacker_user)

        attacker_token = create_access_token(data={"sub": str(attacker_user.id)})
        attacker_headers = {"Authorization": f"Bearer {attacker_token}"}

        # 4. Сотрудник B пытается скачать приватный файл сотрудника A
        attacker_resp = await client.get(
            f"/uploads/voice/{secret_filename}",
            headers=attacker_headers,
        )
        # Защита подтверждена: сторонний сотрудник блокируется кодом 403 Forbidden
        assert attacker_resp.status_code == 403, (
            f"Ожидался статус 403 Forbidden при попытке несанкционированного скачивания, но получен {attacker_resp.status_code}"
        )
        assert "У вас нет прав" in attacker_resp.json()["detail"]

        # 5. Сам автор (сотрудник A) успешно скачивает свой файл
        author_resp = await client.get(
            f"/uploads/voice/{secret_filename}",
            headers=normal_user_token_headers,
        )
        assert author_resp.status_code == 200
        assert author_resp.content == secret_content

        # 6. Администратор системы также имеет легитимный доступ
        admin_resp = await client.get(
            f"/uploads/voice/{secret_filename}",
            headers=admin_token_headers,
        )
        assert admin_resp.status_code == 200
        assert admin_resp.content == secret_content

    finally:
        # Очищаем временный файл
        if os.path.exists(secret_filepath):
            os.remove(secret_filepath)


# =====================================================================
# АТАКА 3: Защита от обхода минимального порога длительности через PATCH
# =====================================================================

@pytest.mark.asyncio
async def test_attack_3_bypass_minimum_15_minutes_duration_via_patch(
    client: AsyncClient,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Атака 3: Контроль минимального порога длительности (15 минут) при обновлении через PATCH.

    Ожидаемое защитное поведение:
        Сервер возвращает HTTP 422 Unprocessable Entity при попытке уменьшить длительность
        переработки менее чем до 15 минут (900 секунд).
    """
    # 1. Создаем валидную переработку на 30 минут
    start_time_iso = "2026-07-10T18:00:00"
    end_time_iso = "2026-07-10T18:30:00"
    create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": start_time_iso,
            "end_time": end_time_iso,
            "description": "Первоначальная валидная переработка (30 минут)",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )
    assert create_resp.status_code == 200, f"Ошибка создания заявки: {create_resp.text}"
    overtime_id = create_resp.json()["id"]

    # 2. Через PATCH пытаемся изменить время окончания на 1 секунду после начала
    exploit_end_time = "2026-07-10T18:00:01"
    patch_resp = await client.patch(
        f"/api/v1/overtimes/{overtime_id}",
        json={
            "end_time": exploit_end_time,
        },
        headers=normal_user_token_headers,
    )

    # Защита подтверждена: запрос отклонен со статусом HTTP 422 Unprocessable Entity
    assert patch_resp.status_code == 422, (
        f"Ожидался статус 422 Unprocessable Entity при попытке установки длительности 1 сек, но получен {patch_resp.status_code}: {patch_resp.text}"
    )
    assert "Минимальная длительность переработки составляет 15 минут" in patch_resp.text


# =====================================================================
# АТАКА 4: Защита от привязки заявки к неактивному проекту через PATCH
# =====================================================================

@pytest.mark.asyncio
async def test_attack_4_bypass_inactive_project_restriction_via_patch(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Атака 4: Запрет привязки заявки к неактивному/архивному проекту через PATCH /overtimes/{id}.

    Ожидаемое защитное поведение:
        Сервер возвращает HTTP 400 Bad Request при попытке изменить project_id на закрытый проект.
    """
    # 1. Создаем закрытый архивный проект
    inactive_project = Project(
        name="Закрытый архивный проект",
        code="2024-99999",
        is_active=False,
        weekly_limit=30,
    )
    db_session.add(inactive_project)
    await db_session.commit()
    await db_session.refresh(inactive_project)

    # 2. Сотрудник создает заявку на активном проекте
    active_create_resp = await client.post(
        "/api/v1/overtimes/",
        json={
            "project_id": test_project.id,
            "start_time": "2026-07-10T18:00:00",
            "end_time": "2026-07-10T19:00:00",
            "description": "Легитимная заявка на активный проект",
            "start_lat": 55.7558,
            "start_lng": 37.6173,
        },
        headers=normal_user_token_headers,
    )
    assert active_create_resp.status_code == 200
    overtime_id = active_create_resp.json()["id"]

    # 3. Попытка переключения проекта на неактивный через PATCH
    patch_resp = await client.patch(
        f"/api/v1/overtimes/{overtime_id}",
        json={
            "project_id": inactive_project.id,
        },
        headers=normal_user_token_headers,
    )

    # Защита подтверждена: сервер возвращает HTTP 400 Bad Request
    assert patch_resp.status_code == 400, (
        f"Ожидался статус 400 Bad Request при привязке к неактивному проекту, но получен {patch_resp.status_code}: {patch_resp.text}"
    )
    assert "Нельзя привязать заявку к неактивному проекту" in patch_resp.json()["detail"]


# =====================================================================
# АТАКА 5: Безопасная валидация создания отдела (head_id и IntegrityError)
# =====================================================================

@pytest.mark.asyncio
async def test_attack_5_server_crash_500_create_department_invalid_head_id(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    admin_token_headers: dict,
):
    """
    Атака 5: Защита от серверного краша 500 / IntegrityError при создании отдела.

    Ожидаемое защитное поведение:
        - При указании несуществующего head_id сервер возвращает HTTP 404 Not Found.
        - При указании валидного head_id отдел успешно создается (HTTP 201 Created).
    """
    await db_session.execute(text("PRAGMA foreign_keys = ON;"))

    try:
        # 1. Попытка создания отдела с заведомо несуществующим руководителем (head_id: 999999)
        resp = await client.post(
            "/api/v1/admin/departments",
            json={
                "name": "Отдел с несуществующим руководителем",
                "head_id": 999999,
            },
            headers=admin_token_headers,
        )
        assert resp.status_code == 404, (
            f"Ожидался статус 404 Not Found при невалидном head_id, но получен {resp.status_code}: {resp.text}"
        )
        assert "не найден" in resp.json()["detail"]

        # 2. Успешное создание отдела с легитимным руководителем
        create_valid = await client.post(
            "/api/v1/admin/departments",
            json={
                "name": "Новый отдел с легитимным руководителем",
                "head_id": admin_user.id,
            },
            headers=admin_token_headers,
        )
        assert create_valid.status_code == 201, (
            f"Ожидался статус 201 Created при валидных данных, но получен {create_valid.status_code}: {create_valid.text}"
        )
        assert create_valid.json()["head_id"] == admin_user.id

    finally:
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys = OFF;"))


# =====================================================================
# АТАКА 6: Защита корпоративного лимита weekly_limit от модификации менеджером
# =====================================================================

@pytest.mark.asyncio
async def test_attack_6_unauthorized_weekly_limit_escalation_by_manager(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_user: User,
    manager_token_headers: dict,
    admin_token_headers: dict,
):
    """
    Атака 6: Защита корпоративного недельного лимита проекта weekly_limit от несанкционированного изменения менеджером.

    Ожидаемое защитное поведение:
        - Попытка менеджера проекта изменить weekly_limit игнорируется (лимит остается неизменным в БД).
        - Только системный администратор имеет право изменять weekly_limit проекта.
    """
    # 1. Создаем проект со строгим корпоративным лимитом 20 часов
    restricted_project = Project(
        name="Проект со строгим лимитом",
        code="2026-77777",
        manager_id=manager_user.id,
        weekly_limit=20,
        is_active=True,
    )
    db_session.add(restricted_project)
    await db_session.commit()
    await db_session.refresh(restricted_project)

    # 2. Менеджер проекта пытается поднять лимит до 168 часов
    patch_resp = await client.patch(
        f"/api/v1/admin/projects/{restricted_project.id}",
        json={
            "weekly_limit": 168,
        },
        headers=manager_token_headers,
    )
    assert patch_resp.status_code == 200

    # Защита подтверждена: для менеджера поле weekly_limit не применилось (осталось 20)
    updated_data = patch_resp.json()
    assert updated_data["weekly_limit"] == 20, (
        f"Ожидался weekly_limit = 20 (изменение менеджером должно игнорироваться), но получено {updated_data['weekly_limit']}"
    )

    await db_session.refresh(restricted_project)
    assert restricted_project.weekly_limit == 20

    # 3. Администратор успешно может менять weekly_limit
    admin_patch_resp = await client.patch(
        f"/api/v1/admin/projects/{restricted_project.id}",
        json={
            "weekly_limit": 35,
        },
        headers=admin_token_headers,
    )
    assert admin_patch_resp.status_code == 200
    assert admin_patch_resp.json()["weekly_limit"] == 35

    await db_session.refresh(restricted_project)
    assert restricted_project.weekly_limit == 35
