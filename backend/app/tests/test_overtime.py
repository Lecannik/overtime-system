import pytest
from httpx import AsyncClient
from app.models.organization import Project

@pytest.mark.asyncio
async def test_create_overtime(client: AsyncClient, admin_token_headers, test_project: Project):
    """Тест успешного создания переработки администратором."""
    overtime_data = {
        "project_id": test_project.id,
        "start_time": "2026-03-01T18:00:00",
        "end_time": "2026-03-01T20:30:00",
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
