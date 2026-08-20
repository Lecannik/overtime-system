"""
Тесты безопасности и доступности интерактивной документации API.

Модуль проверяет, что эндпоинты /docs, /redoc и /openapi.json
недоступны (возвращают 404), когда параметр ENABLE_DOCS отключен.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_api_docs_disabled_by_default():
    """
    Проверяет, что по умолчанию эндпоинты документации (/docs, /redoc, /openapi.json)
    возвращают статус 404 (Not Found) в целях безопасности.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Проверка Swagger UI
        resp_docs = await client.get("/docs")
        assert resp_docs.status_code == 404, f"Ожидался 404 для /docs, получен {resp_docs.status_code}"

        # Проверка ReDoc
        resp_redoc = await client.get("/redoc")
        assert resp_redoc.status_code == 404, f"Ожидался 404 для /redoc, получен {resp_redoc.status_code}"

        # Проверка схемы OpenAPI
        resp_openapi = await client.get("/openapi.json")
        assert resp_openapi.status_code == 404, f"Ожидался 404 для /openapi.json, получен {resp_openapi.status_code}"
