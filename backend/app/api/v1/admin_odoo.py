"""
Модуль API-интеграции административной панели с Odoo CRM.

Поддерживает:
1. Прямую синхронизацию проектов через XML-RPC протокол Odoo.
2. Синхронизацию через внешний микросервис-коннектор Odoo CRM.
"""

from typing import List

# pyrefly: ignore [missing-import]
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_session
from app.models.organization import Project
from app.models.user import User, UserRole
from app.repositories import audit as audit_repo
from app.repositories.user import get_user_by_email
from app.services.odoo_service import odoo_service

router = APIRouter(tags=["admin-odoo"])


def require_admin(current_user: User):
    """
    Проверяет, что текущий пользователь обладает правами администратора.

    Args:
        current_user (User): Текущий аутентифицированный пользователь.

    Raises:
        HTTPException: Если пользователь не является администратором (403 Forbidden).
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен. Требуется роль администратора."
        )


# ==================== ODOO CRM INTEGRATION (XML-RPC) ====================


@router.get("/odoo/status")
async def odoo_integration_status(current_user: User = Depends(get_current_user)):
    """
    Проверить статус подключения к Odoo CRM через XML-RPC.

    Args:
        current_user: Текущий пользователь (должен быть администратором).

    Returns:
        Словарь с флагом configured, URL и именем базы Odoo.
    """
    require_admin(current_user)
    return {
        "configured": odoo_service.is_configured,
        "url": odoo_service.url or None,
        "db": odoo_service.db or None,
    }


@router.get("/odoo/projects")
async def list_odoo_projects(current_user: User = Depends(get_current_user)):
    """
    Получить список активных аналитических проектов из Odoo CRM.

    Args:
        current_user: Текущий пользователь (должен быть администратором).

    Returns:
        JSON со списком проектов и их общим количеством.
    """
    require_admin(current_user)

    if not odoo_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Odoo CRM не настроен. Заполните ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD в .env",
        )

    try:
        projects = await odoo_service.get_projects()
        return {"projects": [p.to_dict() for p in projects], "total": len(projects)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка подключения к Odoo: {str(e)}"
        )


class OdooProjectImportItem(PydanticBaseModel):
    """
    Схема одного проекта для импорта из Odoo CRM.

    Attributes:
        odoo_id (int): Идентификатор проекта в Odoo.
        name (str): Название проекта.
        code (str | None): Номер проекта формата ГГГГ-ННННН.
        manager_email (str | None): Email менеджера для связывания с пользователем.
    """

    odoo_id: int
    name: str
    code: str | None = None
    manager_email: str | None = None


@router.post("/odoo/import")
async def import_odoo_projects(
    projects_to_import: List[OdooProjectImportItem],
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Импортировать выбранные проекты из Odoo CRM в локальную базу данных.

    Args:
        projects_to_import: Список проектов для импорта.
        db: Сессия базы данных.
        current_user: Текущий пользователь-администратор.

    Returns:
        Статистика импортированных, пропущенных записей и ошибок.
    """
    require_admin(current_user)

    imported = 0
    skipped = 0
    errors: list[str] = []

    for item in projects_to_import:
        try:
            if item.code:
                existing = await db.execute(select(Project).where(Project.code == item.code))
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

            manager_id: int | None = None
            if item.manager_email:
                manager_user = await get_user_by_email(db, item.manager_email)
                if manager_user:
                    manager_id = manager_user.id
                else:
                    errors.append(
                        f"Менеджер '{item.manager_email}' не найден в системе — проект '{item.name}' создан без менеджера"
                    )

            new_project = Project(
                name=item.name,
                code=item.code,
                manager_id=manager_id,
            )
            db.add(new_project)
            await db.flush()

            await audit_repo.create_audit_log(
                db,
                current_user.id,
                "IMPORT_PROJECT_ODOO",
                "project",
                new_project.id,
                {
                    "name": item.name,
                    "code": item.code,
                    "odoo_id": item.odoo_id,
                    "manager_email": item.manager_email,
                },
            )
            imported += 1

        except Exception as e:
            errors.append(f"Ошибка при импорте '{item.name}': {str(e)}")
            skipped += 1

    await db.commit()

    return {
        "status": "success",
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }


# ==================== ODOO INTEGRATION MICROSERVICE (API) ====================


@router.get("/odoo-integration/status")
async def odoo_integration_status_api(current_user: User = Depends(get_current_user)):
    """
    Проверить статус интеграции с микросервисом Odoo CRM.

    Args:
        current_user: Текущий пользователь-администратор.

    Returns:
        Статус конфигурации и URL микросервиса.
    """
    require_admin(current_user)
    return {
        "configured": bool(settings.odoo.integration_url and settings.odoo.integration_key),
        "url": settings.odoo.integration_url or None,
    }


@router.get("/odoo-integration/projects")
async def list_odoo_integration_projects(
    fields: List[str] = Query(None, description="Список полей, запрашиваемых из Odoo"),
    name: str = Query(None, description="Фильтр по названию проекта (частичное совпадение)"),
    code: str = Query(None, description="Фильтр по коду проекта (частичное совпадение)"),
    current_user: User = Depends(get_current_user),
):
    """
    Получить проекты из Odoo через микросервис-коннектор по HTTP API.

    Args:
        fields: Запрашиваемые поля проекта.
        name: Фильтр по названию.
        code: Фильтр по коду.
        current_user: Текущий пользователь-администратор.

    Returns:
        Список проектов из внешнего микросервиса.
    """
    require_admin(current_user)

    if not settings.odoo.integration_url or not settings.odoo.integration_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Микросервис Odoo CRM не настроен. Заполните ODOO_INTEGRATION_URL and ODOO_INTEGRATION_KEY в .env",
        )

    params = {}
    if fields:
        params["fields"] = fields
    if name:
        params["name"] = name
    if code:
        params["code"] = code

    headers = {"X-API-Key": settings.odoo.integration_key}

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                f"{settings.odoo.integration_url.rstrip('/')}/api/v1/projects", params=params, headers=headers
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, detail=f"Ошибка сервиса интеграции Odoo: {response.text}"
                )
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Ошибка соединения с сервисом интеграции Odoo: {str(e)}",
            )


class OdooIntegrationImportItem(PydanticBaseModel):
    """Схема проекта для импорта из микросервиса Odoo."""

    id: int
    name: str | None = None
    code: str | None = None
    status: str | None = None


@router.post("/odoo-integration/import")
async def import_odoo_integration_projects(
    projects_to_import: List[OdooIntegrationImportItem],
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Импортировать выбранные проекты из микросервиса Odoo в локальную БД.

    Args:
        projects_to_import: Список проектов для импорта.
        db: Сессия базы данных.
        current_user: Текущий пользователь-администратор.

    Returns:
        Результаты операции с количеством добавленных и пропущенных проектов.
    """
    require_admin(current_user)

    imported = 0
    skipped = 0
    errors: List[str] = []

    for item in projects_to_import:
        try:
            name = item.name or f"Odoo Project {item.id}"

            if item.code:
                existing = await db.execute(select(Project).where(Project.code == item.code))
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue
            else:
                existing = await db.execute(select(Project).where(Project.name == name))
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

            is_active = True
            if item.status and item.status not in ("active", "worked", "draft"):
                is_active = False

            new_project = Project(name=name, code=item.code, is_active=is_active, weekly_limit=200)
            db.add(new_project)
            await db.flush()

            await audit_repo.create_audit_log(
                db,
                current_user.id,
                "IMPORT_PROJECT_ODOO_INTEGRATION",
                "project",
                new_project.id,
                {
                    "name": name,
                    "code": item.code,
                    "odoo_id": item.id,
                    "status": item.status,
                },
            )
            imported += 1

        except Exception as e:
            errors.append(f"Ошибка при импорте '{item.id}': {str(e)}")
            skipped += 1

    await db.commit()

    return {
        "status": "success",
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }
