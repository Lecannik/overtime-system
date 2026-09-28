# pyrefly: ignore [missing-import]
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from app.models.organization import Project
from app.models.user import User
from app.models.overtime import Overtime, OvertimeStatus


@pytest.mark.asyncio
async def test_personal_stats_empty(
    client: AsyncClient,
    normal_user_token_headers: dict
):
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
    test_project: Project
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
        description="Согласованная работа"
    )

    # 2. Создаем переработку на согласовании (PENDING) на сегодня (2 часа)
    pending_ot = Overtime(
        user_id=normal_user.id,
        project_id=test_project.id,
        start_time=now - timedelta(hours=2),
        end_time=now,
        status=OvertimeStatus.PENDING,
        description="Работа на проверке"
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
