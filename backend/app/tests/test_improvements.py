from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from app.models.organization import Project
from app.services.ms_graph import MSGraphService


@pytest.mark.asyncio
async def test_ms_graph_token_caching():
    """Тест In-memory кэширования токена MS Graph (MSAL Singleton + acquire_token_for_client).

    В client-credentials flow метод acquire_token_for_client автоматически
    проверяет in-memory кеш MSAL и возвращает кешированный токен,
    если он ещё валиден. Повторная авторизация выполняется только при истечении.
    """
    service = MSGraphService()
    mock_app = MagicMock()
    service._app = mock_app

    # 1-й вызов: acquire_token_for_client возвращает токен (из кеша или сети — MSAL решает сам)
    mock_app.acquire_token_for_client.return_value = {"access_token": "cached_token_xyz"}
    token = await service._get_access_token()
    assert token == "cached_token_xyz"
    mock_app.acquire_token_for_client.assert_called_once_with(scopes=service.scope)

    # 2-й вызов: повторный запрос — acquire_token_for_client вызывается снова (MSAL отдаст из кеша)
    mock_app.acquire_token_for_client.reset_mock()
    mock_app.acquire_token_for_client.return_value = {"access_token": "still_cached_token"}
    token2 = await service._get_access_token()
    assert token2 == "still_cached_token"
    mock_app.acquire_token_for_client.assert_called_once_with(scopes=service.scope)


@pytest.mark.asyncio
async def test_overtime_presets_filtering(client: AsyncClient, admin_token_headers: dict, test_project: Project):
    """Тест смарт-фильтров пресетов action_required и in_review."""
    # 1. Создаем заявку
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-04-10T04:00:00",
        "end_time": "2026-04-10T07:00:00",
        "description": "Preset Filter Test",
        "start_lat": 10.0,
        "start_lng": 20.0,
    }
    create_res = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert create_res.status_code == 200
    created_id = create_res.json()["id"]

    # 2. Запрос списка с preset=action_required
    res_req = await client.get("/api/v1/overtimes/?preset=action_required&view=review", headers=admin_token_headers)
    assert res_req.status_code == 200
    items_req = res_req.json()["items"]
    assert any(o["id"] == created_id for o in items_req)

    # 3. Запрос списка с preset=in_review
    res_in_review = await client.get("/api/v1/overtimes/?preset=in_review&view=review", headers=admin_token_headers)
    assert res_in_review.status_code == 200
    items_in_review = res_in_review.json()["items"]
    assert any(o["id"] == created_id for o in items_in_review)


@pytest.mark.asyncio
async def test_calendar_summary_with_filters(client: AsyncClient, admin_token_headers: dict, test_project: Project):
    """Тест синхронизации календаря с фильтрами preset, status и department_id."""
    # Создаем заявку на целевую дату
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-05-15T04:00:00",
        "end_time": "2026-05-15T07:00:00",
        "description": "Calendar Filter Test",
        "start_lat": 10.0,
        "start_lng": 20.0,
    }
    create_res = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert create_res.status_code == 200

    res = await client.get(
        "/api/v1/overtimes/calendar-summary?month=2026-05&preset=action_required", headers=admin_token_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "2026-05-15" in data
    assert data["2026-05-15"]["total"] >= 1


@pytest.mark.asyncio
async def test_analytics_summary_status_hours(client: AsyncClient, admin_token_headers: dict):
    """Тест двухрежимных показателей аналитики (шт. и часы по статусам)."""
    res = await client.get("/api/v1/analytics/summary", headers=admin_token_headers)
    assert res.status_code == 200
    data = res.json()
    assert "approved_hours" in data
    assert "pending_hours" in data
    assert "rejected_hours" in data
    assert isinstance(data["approved_hours"], (int, float))
    assert isinstance(data["pending_hours"], (int, float))
    assert isinstance(data["rejected_hours"], (int, float))


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Тест расширенного health-check эндпоинта: проверяет БД, TG-бота, Whisper и MS Graph."""
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["status"] in ("ok", "degraded")
    assert "checks" in data
    assert data["checks"]["database"] == "ok"
    assert "telegram_bot" in data["checks"]
    assert "whisper_model" in data["checks"]
    assert "ms_graph" in data["checks"]
