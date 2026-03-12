"""
Admin API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.security import hash_password

from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.repositories import user as user_repo
from app.schemas.user import UserAdminUpdate, UserResponse, UserCreateByAdmin
from app.repositories.user import get_user_by_id, update_user, get_all_users

from app.models.organization import Department, Project
from app.schemas.organization import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
)

from app.repositories import organization as org_repo

from app.schemas.settings import SystemSettingSchema, SystemSettingUpdate
from app.repositories import settings as settings_repo


router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User):
    """Проверяет, что текущий пользователь — администратор."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуется роль администратора."
        )


# ==================== DEPARTMENTS ====================

@router.post("/departments", response_model=DepartmentResponse, status_code=201)
async def create_department(
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Создать новый отдел.

    Доступно только администраторам.
    """
    require_admin(current_user)
    department = Department(**dept_in.model_dump())
    return await org_repo.create_department(db, department)


@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список всех отделов.

    Доступно только администраторам.
    """
    require_admin(current_user)
    return await org_repo.get_departments(db)


@router.get("/departments/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить отдел по ID.
    """
    require_admin(current_user)
    dept = await org_repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    return dept


@router.patch("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Обновить отдел (название, начальник).

    Доступно только администраторам. Передайте только те поля, которые хотите изменить.
    """
    require_admin(current_user)
    dept = await org_repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    return await org_repo.update_department(db, dept, dept_in.model_dump(exclude_unset=True))


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Удалить отдел.

    Доступно только администраторам. Внимание: убедитесь, что в отделе нет сотрудников.
    """
    require_admin(current_user)
    dept = await org_repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    await org_repo.delete_department(db, dept)


# ==================== PROJECTS ====================

@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Создать новый проект.

    Доступно только администраторам. Необходимо указать ID менеджера.
    """
    require_admin(current_user)
    project = Project(**project_in.model_dump())
    return await org_repo.create_project(db, project)


@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список всех проектов.

    Доступно только администраторам.
    """
    require_admin(current_user)
    return await org_repo.get_projects(db)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить проект по ID.
    """
    require_admin(current_user)
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Обновить проект (название, менеджер).

    Доступно только администраторам. Передайте только те поля, которые хотите изменить.
    """

    require_admin(current_user)
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return await org_repo.update_project(db, project, project_in.model_dump(exclude_unset=True))


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Удалить проект.

    Доступно только администраторам. Внимание: убедитесь, что проект не связан с заявками.
    """
    require_admin(current_user)
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    await org_repo.delete_project(db, project)

# ==================== USERS ====================

@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    user_in: UserCreateByAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Создать нового пользователя.
    Доступно только администраторам.
    """
    require_admin(current_user)
    
    from app.services.auth import register_user
    new_user = await register_user(db, user_in)
    
    # Сразу ставим флаг смены пароля, так как пароль задал админ
    await user_repo.update_user(db, new_user, {"must_change_password": True})
    return new_user


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список всех пользователей.

    Доступно только администраторам.
    """
    require_admin(current_user)
    return await user_repo.get_all_users(db)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить пользователя по ID.
    """
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    user_in: UserAdminUpdate,      # <-- не DepartmentUpdate!
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить пользователя (роль, отдел, активность)."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return await user_repo.update_user(db, user, user_in.model_dump(exclude_unset=True))


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сбросить пароль пользователя (только для админов)."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    new_password = "changeme123"
    await user_repo.update_user(db, user, {
        "hashed_password": hash_password(new_password),
        "must_change_password": True
    })
    return {"detail": f"Пароль сброшен на: {new_password}"}
 
 
@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Удалить пользователя.
 
    Доступно только администраторам.
    """
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Не даем админу удалить самого себя
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Вы не можете удалить свою собственную учетную запись")
        
    await user_repo.delete_user(db, user)


# ==================== SYSTEM SETTINGS ====================

@router.get("/settings/{key}", response_model=SystemSettingSchema)
async def get_admin_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить значение системной настройки (только для админов)."""
    require_admin(current_user)
    value = await settings_repo.get_setting(db, key)
    if value is None:
        raise HTTPException(status_code=404, detail="Настройка не найдена")
    return {"key": key, "value": value}

@router.post("/settings/{key}", response_model=SystemSettingSchema)
async def set_admin_setting(
    key: str,
    setting_in: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Установить значение системной настройки (только для админов)."""
    require_admin(current_user)
    return await settings_repo.set_setting(db, key, setting_in.value)
