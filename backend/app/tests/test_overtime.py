import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Project
from app.models.user import User
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_create_overtime(client: AsyncClient, admin_token_headers, test_project: Project):
    """Тест успешного создания переработки администратором."""
    # Используем UTC 04:00-06:30 = Almaty 09:00-11:30 — не пересекает 00:00, сплит не происходит
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-03-01T04:00:00",
        "end_time": "2026-03-01T06:30:00",
        "description": "Test Overtime",
        "start_lat": 10.0,
        "start_lng": 20.0
    }

    response = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["project_id"] == test_project.id
    assert data["description"] == "Test Overtime"
    # 2.5 часа округляются вверх до целого (3.0 часа)
    assert data["hours"] == 3.0


@pytest.mark.asyncio
async def test_rbac_list_overtimes(client: AsyncClient, normal_user_token_headers):
    """Тест получения списка переработок обычным пользователем (поддерживающим пагинацию)."""
    response = await client.get("/api/v1/overtimes/", headers=normal_user_token_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, dict)
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_review_overtime_permission(client: AsyncClient, normal_user_token_headers):
    """Тест: обычный сотрудник не имеет прав согласовывать заявки."""
    review_data = {"approved": True, "comment": "I approve myself!"}
    response = await client.post("/api/v1/overtimes/1/review", json=review_data, headers=normal_user_token_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_review_overtime_approved_by_head_within_limit(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    manager_user: User,
    head_user: User,
    head_token_headers: dict,
    test_project: Project
):
    """Тест: если начальник отдела одобрил, а лимит не превышен — статус APPROVED (bypass)."""
    # Привязываем менеджера к проекту
    test_project.manager_id = manager_user.id
    db_session.add(test_project)
    await db_session.commit()

    # Динамические даты в пределах текущей недели
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    # Создаем заявку от обычного пользователя
    overtime_data = {
        "project_id": test_project.id,
        "start_time": start_time,
        "end_time": end_time,
        "description": "Test Overtime Within Limit",
        "start_lat": 10.0,
        "start_lng": 20.0
    }
    
    create_resp = await client.post("/api/v1/overtimes/", json=overtime_data, headers=normal_user_token_headers)
    assert create_resp.status_code == 200
    overtime_id = create_resp.json()["id"]

    # Начальник одобряет
    review_data = {"approved": True, "comment": "Approved by head", "as_role": "head"}
    review_resp = await client.post(f"/api/v1/overtimes/{overtime_id}/review", json=review_data, headers=head_token_headers)
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_review_overtime_head_approved_when_limit_exceeded(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    manager_user: User,
    manager_token_headers: dict,
    head_user: User,
    head_token_headers: dict,
    test_project: Project
):
    """Тест: если начальник отдела одобрил, но лимит превышен — статус HEAD_APPROVED, а после менеджера — APPROVED."""
    # Изменяем лимит проекта на 1 час и привязываем менеджера
    test_project.weekly_limit = 1
    test_project.manager_id = manager_user.id
    db_session.add(test_project)
    await db_session.commit()

    # Динамические даты в пределах текущей недели (запрос на 3 часа)
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    # Создаем заявку на 3 часа от обычного пользователя (превышает лимит 1 час)
    overtime_data = {
        "project_id": test_project.id,
        "start_time": start_time,
        "end_time": end_time,
        "description": "Test Overtime Over Limit",
        "start_lat": 10.0,
        "start_lng": 20.0
    }
    
    create_resp = await client.post("/api/v1/overtimes/", json=overtime_data, headers=normal_user_token_headers)
    assert create_resp.status_code == 200
    overtime_id = create_resp.json()["id"]

    # Начальник одобряет
    review_data = {"approved": True, "comment": "Approved by head", "as_role": "head"}
    review_resp = await client.post(f"/api/v1/overtimes/{overtime_id}/review", json=review_data, headers=head_token_headers)
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "HEAD_APPROVED"

    # Теперь менеджер одобряет
    manager_review_data = {"approved": True, "comment": "Approved by manager", "as_role": "manager"}
    review_resp2 = await client.post(f"/api/v1/overtimes/{overtime_id}/review", json=manager_review_data, headers=manager_token_headers)
    assert review_resp2.status_code == 200
    assert review_resp2.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_cannot_review_in_progress_overtime(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    head_token_headers: dict,
    test_project: Project
):
    """Тест: нельзя согласовать заявку, которая находится в процессе (IN_PROGRESS), и она исключается из review-списка."""
    # Создаем заявку
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")
    end_time = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")

    overtime_data = {
        "project_id": test_project.id,
        "start_time": start_time,
        "end_time": end_time,
        "description": "Active Session Overtime",
        "start_lat": 10.0,
        "start_lng": 20.0
    }
    create_resp = await client.post("/api/v1/overtimes/", json=overtime_data, headers=normal_user_token_headers)
    assert create_resp.status_code == 200
    overtime_id = create_resp.json()["id"]

    # Принудительно меняем статус на IN_PROGRESS через БД
    from app.models.overtime import Overtime, OvertimeStatus
    from sqlalchemy import select
    res = await db_session.execute(select(Overtime).where(Overtime.id == overtime_id))
    overtime_obj = res.scalar_one()
    overtime_obj.status = OvertimeStatus.IN_PROGRESS
    overtime_obj.end_time = None
    db_session.add(overtime_obj)
    await db_session.commit()

    # Пробуем согласовать (должно выдать 400 Bad Request)
    review_data = {"approved": True, "comment": "Trying to approve unfinished", "as_role": "head"}
    review_resp = await client.post(f"/api/v1/overtimes/{overtime_id}/review", json=review_data, headers=head_token_headers)
    assert review_resp.status_code == 400
    assert "процессе выполнения" in review_resp.json()["detail"]

    # Проверяем, что в списке для согласования (?view=review) эта заявка отсутствует
    list_resp = await client.get("/api/v1/overtimes/?view=review", headers=head_token_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert not any(item["id"] == overtime_id for item in items)


def test_split_interval_by_days_logic():
    """Тест чистой логики разделения интервала по границам суток."""
    from app.core.utils import split_interval_by_days
    from datetime import datetime, timezone

    # Стык дней (18.06.2026 22:00 до 19.06.2026 02:00 по времени Asia/Almaty)
    # 22:00 по Алматы = 17:00 UTC
    # 02:00 по Алматы = 21:00 UTC
    start = datetime(2026, 6, 18, 17, 0, 0)
    end = datetime(2026, 6, 18, 21, 0, 0)

    intervals = split_interval_by_days(start, end)
    assert len(intervals) == 2
    # Функция возвращает UTC-aware datetime
    # Первая часть: 22:00 до 00:00 (17:00 UTC до 19:00 UTC)
    assert intervals[0] == (
        datetime(2026, 6, 18, 17, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 6, 18, 19, 0, 0, tzinfo=timezone.utc),
    )
    # Вторая часть: 00:00 до 02:00 (19:00 UTC до 21:00 UTC)
    assert intervals[1] == (
        datetime(2026, 6, 18, 19, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 6, 18, 21, 0, 0, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_overtime_creation_split_by_days(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    test_project: Project
):
    """Тест: при создании переработки, пересекающей границу суток, создается несколько заявок."""
    from app.models.overtime import Overtime
    from sqlalchemy import select

    # Используем статическую прошедшую дату: 2026-01-15 22:00 - 2026-01-16 02:00 по Almaty
    # = 17:00 - 21:00 UTC 2026-01-15 (гарантированно в прошлом)
    start_time = "2026-01-15T17:00:00"
    end_time = "2026-01-15T21:00:00"

    overtime_data = {
        "project_id": test_project.id,
        "start_time": start_time,
        "end_time": end_time,
        "description": "Multi-day overtime",
        "start_lat": 10.0,
        "start_lng": 20.0
    }

    res_before = await db_session.execute(select(Overtime))
    count_before = len(res_before.scalars().all())

    response = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert response.status_code == 200

    db_session.expire_all()
    res_after = await db_session.execute(select(Overtime))
    overtimes = res_after.scalars().all()
    assert len(overtimes) - count_before == 2

    parts = sorted(overtimes, key=lambda x: x.start_time)[-2:]

    # Колонки timestamptz — SQLAlchemy возвращает UTC-aware datetime
    # Первая часть: 17:00 до 19:00 UTC (22:00 - 00:00 Almaty)
    assert parts[0].start_time.replace(tzinfo=None).isoformat() == "2026-01-15T17:00:00"
    assert parts[0].end_time.replace(tzinfo=None).isoformat() == "2026-01-15T19:00:00"

    # Вторая часть: 19:00 до 21:00 UTC (00:00 - 02:00 Almaty)
    assert parts[1].start_time.replace(tzinfo=None).isoformat() == "2026-01-15T19:00:00"
    assert parts[1].end_time.replace(tzinfo=None).isoformat() == "2026-01-15T21:00:00"


@pytest.mark.asyncio
async def test_max_overtime_duration_rejected(
    client: AsyncClient,
    admin_token_headers: dict,
    test_project: Project,
):
    """Тест: заявка длиннее MAX_OVERTIME_HOURS отклоняется с HTTP 400."""
    from app.core.config import settings

    # Запрашиваем ровно на 1 час больше лимита — должно быть отклонено
    start_dt = datetime(2026, 1, 10, 0, 0, 0)
    end_dt = start_dt + timedelta(hours=settings.MAX_OVERTIME_HOURS + 1)
    overtime_data = {
        "project_id": test_project.id,
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "description": "Too long",
        "start_lat": 10.0,
        "start_lng": 20.0,
    }

    response = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert response.status_code == 400
    assert "максимум" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_overtime_time_logs_audit(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: dict,
    test_project: Project,
):
    """Тест: изменение времени переработки вызывает запись в журнал аудита."""
    from app.models.audit import AuditLog
    from app.models.overtime import Overtime
    from sqlalchemy import select

    # 1. Создаем переработку
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-03-01T04:00:00",
        "end_time": "2026-03-01T06:30:00",
        "description": "Log test",
        "start_lat": 10.0,
        "start_lng": 20.0
    }
    response = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert response.status_code == 200
    ot_id = response.json()["id"]

    # 2. Обновляем время окончания
    update_data = {
        "end_time": "2026-03-01T06:00:00"
    }
    patch_resp = await client.patch(f"/api/v1/overtimes/{ot_id}", json=update_data, headers=admin_token_headers)
    assert patch_resp.status_code == 200

    # 3. Проверяем, что в аудит-логе появилась запись
    db_session.expire_all()
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "UPDATE_OVERTIME_TIME",
            AuditLog.target_id == ot_id
        )
    )
    logs = audit_res.scalars().all()
    assert len(logs) == 1
    log = logs[0]
    
    # Проверяем структуру деталей
    assert log.target_type == "overtime"
    assert log.details["new_end"].startswith("2026-03-01T06:00:00")
    assert log.details["old_end"].startswith("2026-03-01T06:30:00")
    assert log.details["old_hours"] == 3.0
    assert log.details["new_hours"] == 2.0

