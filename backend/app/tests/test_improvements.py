import pytest
from unittest.mock import MagicMock
from httpx import AsyncClient
from app.models.organization import Project
from app.services.ms_graph import MSGraphService


@pytest.mark.asyncio
async def test_ms_graph_token_caching():
    """Тест In-memory кэширования токена MS Graph (MSAL Singleton + acquire_token_silent)."""
    service = MSGraphService()
    mock_app = MagicMock()
    service._app = mock_app

    # 1-й вызов: acquire_token_silent возвращает валидный токен из in-memory кэша MSAL
    mock_app.acquire_token_silent.return_value = {"access_token": "cached_token_xyz"}
    token = await service._get_access_token()
    assert token == "cached_token_xyz"
    mock_app.acquire_token_silent.assert_called_once_with(service.scope, account=None)
    mock_app.acquire_token_for_client.assert_not_called()

    # 2-й вызов: silent вернул None (токен истек), обращаемся к сети через acquire_token_for_client
    mock_app.acquire_token_silent.return_value = None
    mock_app.acquire_token_for_client.return_value = {"access_token": "fresh_network_token"}
    fresh_token = await service._get_access_token()
    assert fresh_token == "fresh_network_token"
    mock_app.acquire_token_for_client.assert_called_once_with(scopes=service.scope)


@pytest.mark.asyncio
async def test_overtime_presets_filtering(
    client: AsyncClient,
    admin_token_headers: dict,
    test_project: Project
):
    """Тест смарт-фильтров пресетов action_required и in_review."""
    # 1. Создаем заявку
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-04-10T04:00:00",
        "end_time": "2026-04-10T07:00:00",
        "description": "Preset Filter Test",
        "start_lat": 10.0,
        "start_lng": 20.0
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
async def test_calendar_summary_with_filters(
    client: AsyncClient,
    admin_token_headers: dict,
    test_project: Project
):
    """Тест синхронизации календаря с фильтрами preset, status и department_id."""
    # Создаем заявку на целевую дату
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-05-15T04:00:00",
        "end_time": "2026-05-15T07:00:00",
        "description": "Calendar Filter Test",
        "start_lat": 10.0,
        "start_lng": 20.0
    }
    create_res = await client.post("/api/v1/overtimes/", json=overtime_data, headers=admin_token_headers)
    assert create_res.status_code == 200

    res = await client.get(
        "/api/v1/overtimes/calendar-summary?month=2026-05&preset=action_required",
        headers=admin_token_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "2026-05-15" in data
    assert data["2026-05-15"]["total"] >= 1


@pytest.mark.asyncio
async def test_analytics_summary_status_hours(
    client: AsyncClient,
    admin_token_headers: dict
):
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
