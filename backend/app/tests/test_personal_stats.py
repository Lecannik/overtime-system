# pyrefly: ignore [missing-import]
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Project
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User


@pytest.mark.asyncio
async def test_personal_stats_empty(client: AsyncClient, normal_user_token_headers: dict):
    """
    Тест: для пользователя без заявок возвращается ровно 30 дней с нулевыми часами.
    """
    response = await client.get("/api/v1/overtimes/stats/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["total_requests"] == 0
    assert data["active_requests"] == 0
    assert data["current_month_hours"] == 0.0
    assert len(data["daily_stats"]) == 30

    for item in data["daily_stats"]:
        assert "date" in item
        assert item["hours"] == 0.0
        assert item["pending_hours"] == 0.0


@pytest.mark.asyncio
async def test_personal_stats_approved_and_pending_separation(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Тест: проверка разделения часов на согласованные (hours) и находящиеся на согласовании (pending_hours).
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    # 1. Создаем согласованную переработку на сегодня (3 часа)
    approved_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=now - timedelta(hours=4),
        end_time=now - timedelta(hours=1),
        approved_hours=3.0,
        status=OvertimeStatus.APPROVED,
        description="Согласованная работа",
    )

    # 2. Создаем переработку на согласовании (PENDING) на сегодня (2 часа)
    pending_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=now - timedelta(hours=2),
        end_time=now,
        status=OvertimeStatus.PENDING,
        description="Работа на проверке",
    )

    db_session.add(approved_ot)
    db_session.add(pending_ot)
    await db_session.commit()

    response = await client.get("/api/v1/overtimes/stats/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["total_requests"] == 2
    assert data["active_requests"] == 1
    assert data["current_month_hours"] == 3.0
    assert len(data["daily_stats"]) == 30

    today_iso = today.isoformat()
    today_stats = next((item for item in data["daily_stats"] if item["date"] == today_iso), None)
    assert today_stats is not None
    assert today_stats["hours"] == 3.0
    assert today_stats["pending_hours"] == 2.0


@pytest.mark.asyncio
async def test_personal_stats_timezone_start_of_month(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    normal_user_token_headers: dict,
    test_project: Project,
):
    """
    Тест: заявка, начавшаяся 1-го числа месяца в 00:00 по локальному времени (Asia/Almaty),
    в UTC сохраняется как 19:00 предыдущего дня.
    Проверяем, что get_personal_stats относит её к текущему месяцу (current_month_hours),
    а не к прошлому месяцу (last_month_hours).
    """
    from app.core.config import settings

    now_local = datetime.now(settings.tz_info)
    # Полночь 1-го числа текущего месяца в локальном времени
    first_of_month_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Конвертируем в UTC (это 19:00 последнего дня прошлого месяца)
    first_of_month_utc = first_of_month_local.astimezone(timezone.utc)

    ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=first_of_month_utc,
        end_time=first_of_month_utc + timedelta(hours=2),
        approved_hours=2.0,
        status=OvertimeStatus.APPROVED,
        description="Переработка в полночь 1-го числа",
    )
    db_session.add(ot)
    await db_session.commit()

    response = await client.get("/api/v1/overtimes/stats/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    data = response.json()

    # Часы должны попасть строго в текущий месяц!
    assert data["current_month_hours"] == 2.0
    assert data["last_month_hours"] == 0.0


@pytest.mark.asyncio
async def test_team_weekly_overtime_limit_shared_pool(
    client: AsyncClient,
    db_session: AsyncSession,
    normal_user: User,
    manager_user: User,
    head_user: User,
    head_token_headers: dict,
    test_project: Project,
):
    """
    Тест: недельный лимит проекта (weekly_limit) распространяется на всю команду суммарно.
    Сотрудник 1 выработал 3 часа, сотрудник 2 подает 3 часа (суммарно 6ч при лимите проекта 5ч).
    При согласовании заявки сотрудника 2 начальником отдела статус становится HEAD_APPROVED,
    так как командный пул проекта превышен.
    """
    from app.models.organization import Department

    dept = Department(name="Тестовый отдел лимитов", head_id=head_user.id)
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)

    normal_user.department_id = dept.id
    test_project.manager_id = manager_user.id
    test_project.weekly_limit = 5  # Командный лимит проекта: 5 часов
    db_session.add_all([normal_user, test_project])
    await db_session.commit()

    # 1. Первый сотрудник уже имеет 3 часа на этой неделе
    now = datetime.now(timezone.utc)
    ot1 = Overtime(
        user_id=manager_user.id,  # другой сотрудник
        project_id=test_project.id,
        start_time=now - timedelta(hours=5),
        end_time=now - timedelta(hours=2),
        approved_hours=3.0,
        status=OvertimeStatus.APPROVED,
        description="Работа сотрудника 1 (3ч)",
    )
    db_session.add(ot1)
    await db_session.commit()

    # 2. Второй сотрудник (normal_user) создает заявку на 3 часа (суммарно 3 + 3 = 6 > 5)
    ot2 = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=now - timedelta(hours=3),
        end_time=now,
        status=OvertimeStatus.PENDING,
        description="Работа сотрудника 2 (3ч)",
    )
    db_session.add(ot2)
    await db_session.commit()
    await db_session.refresh(ot2)

    # 3. Начальник отдела одобряет заявку сотрудника 2
    review_resp = await client.post(
        f"/api/v1/overtimes/{ot2.id}/review",
        json={"approved": True, "comment": "Одобрено начальником", "as_role": "head"},
        headers=head_token_headers,
    )
    assert review_resp.status_code == 200
    # Так как командный пул проекта превышен (6ч > 5ч), статус переходит в HEAD_APPROVED!
    assert review_resp.json()["status"] == "HEAD_APPROVED"
