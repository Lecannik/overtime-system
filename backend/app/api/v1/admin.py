"""
Admin API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.core.security import hash_password

from app.api.deps import get_current_user
from app.models.user import User, UserCompany, Role, Permission
from app.repositories import user as user_repo
from app.schemas.user import (
    UserAdminUpdate, UserResponse, UserCreateByAdmin, PaginatedUsersResponse,
    RoleResponse, PermissionResponse, RolePermissionsSync
)
from app.repositories.user import get_user_by_id, update_user, get_all_users

from app.models.organization import Department, Project, JobPosition
from app.schemas.organization import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentTreeResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    JobPositionCreate, JobPositionUpdate, JobPositionResponse, HierarchyNodeResponse,
    PositionPermissionsSync
)

from app.models.crm import Lead, Deal, CRMStage
from app.models.settings import SystemSetting
from app.models.task import TaskType
from app.schemas.settings import SystemSettingSchema, SystemSettingUpdate
from app.schemas.crm import CRMStageCreate, CRMStageUpdate, CRMStageResponse
from app.schemas.task import (
    TaskTypeCreate, TaskTypeUpdate, TaskTypeResponse,
    TaskStatusCreate, TaskStatusUpdate, TaskStatusResponse
)

from app.repositories import organization as org_repo
from app.repositories import settings as settings_repo
from app.repositories import audit as audit_repo

from app.services.ms_graph import ms_graph
from app.repositories.user import get_user_by_email
from app.repositories.permissions import PermissionRepository
from app.schemas.permissions import StagePermissionResponse, SyncStagePermissions


router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User):
    """Проверяет, что текущий пользователь — администратор."""
    if current_user.role_name.lower() != "admin":
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
    """Создать новый отдел."""
    require_admin(current_user)
    department = Department(**dept_in.model_dump())
    new_dept = await org_repo.create_department(db, department)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_DEPT", "department", new_dept.id, {"name": new_dept.name}
    )
    await db.commit()
    
    # Подгружаем связанные данные для корректной сериализации
    return await org_repo.get_department_by_id(db, new_dept.id)


@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить плоский список всех отделов."""
    require_admin(current_user)
    return await org_repo.get_departments(db)


@router.get("/departments/tree", response_model=List[DepartmentTreeResponse])
async def get_department_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить дерево отделов."""
    require_admin(current_user)
    
    # Загружаем ВСЕ отделы одним запросом с менеджерами и их данными
    result = await db.execute(
        select(Department).options(
            selectinload(Department.manager).selectinload(User.department),
            selectinload(Department.manager).selectinload(User.job_position),
            selectinload(Department.manager).selectinload(User.role_obj)
        )
    )
    all_depts = result.scalars().all()
    
    from collections import defaultdict
    by_parent = defaultdict(list)
    for d in all_depts:
        by_parent[d.parent_id].append(d)
        
    def build_tree(parent_id):
        tree = []
        for d in by_parent[parent_id]:
            # Создаем схему вручную, чтобы избежать ленивой загрузки отношений
            node = DepartmentTreeResponse(
                id=d.id,
                name=d.name,
                parent_id=d.parent_id,
                manager_id=d.manager_id,
                manager=UserResponse.model_validate(d.manager) if d.manager else None,
                sub_departments=build_tree(d.id)
            )
            tree.append(node)
        return tree
        
    return build_tree(None)


@router.patch("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить отдел."""
    require_admin(current_user)
    dept = await org_repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    
    updated_dept = await org_repo.update_department(db, dept, dept_in.model_dump(exclude_unset=True))
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_DEPT", "department", dept_id, dept_in.model_dump(exclude_unset=True)
    )
    await db.commit()
    return updated_dept


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить отдел."""
    require_admin(current_user)
    dept = await org_repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    await org_repo.delete_department(db, dept)


# ==================== CRM STAGES ====================

@router.post("/crm-stages", response_model=CRMStageResponse, status_code=201)
async def create_crm_stage(
    stage_in: CRMStageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую стадию CRM."""
    require_admin(current_user)
    stage = CRMStage(**stage_in.model_dump())
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.get("/crm-stages", response_model=List[CRMStageResponse])
async def list_crm_stages(
    module: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех стадий CRM."""
    require_admin(current_user)
    query = select(CRMStage).order_by(CRMStage.sort_order)
    if module:
        query = query.where(CRMStage.module == module)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/crm-stages/{stage_id}", response_model=CRMStageResponse)
async def update_crm_stage(
    stage_id: int,
    stage_in: CRMStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить стадию CRM."""
    require_admin(current_user)
    stage = await db.get(CRMStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Стадия не найдена")
    
    for key, value in stage_in.model_dump(exclude_unset=True).items():
        setattr(stage, key, value)
    
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/crm-stages/{stage_id}", status_code=204)
async def delete_crm_stage(
    stage_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить стадию CRM."""
    require_admin(current_user)
    stage = await db.get(CRMStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Стадия не найдена")
    await db.delete(stage)
    await db.commit()


# ==================== TASK TYPES ====================

@router.post("/task-types", response_model=TaskTypeResponse, status_code=201)
async def create_task_type(
    type_in: TaskTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новый тип задачи."""
    require_admin(current_user)
    task_type = TaskType(**type_in.model_dump())
    db.add(task_type)
    await db.commit()
    await db.refresh(task_type)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_TASK_TYPE", "task_type", task_type.id, type_in.model_dump()
    )
    return task_type


@router.get("/task-types", response_model=List[TaskTypeResponse])
async def list_task_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех типов задач."""
    require_admin(current_user)
    result = await db.execute(select(TaskType).order_by(TaskType.name))
    return result.scalars().all()


@router.patch("/task-types/{type_id}", response_model=TaskTypeResponse)
async def update_task_type(
    type_id: int,
    type_in: TaskTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить тип задачи."""
    require_admin(current_user)
    task_type = await db.get(TaskType, type_id)
    if not task_type:
        raise HTTPException(status_code= status.HTTP_404_NOT_FOUND, detail="Тип задачи не найден")
    
    for key, value in type_in.model_dump(exclude_unset=True).items():
        setattr(task_type, key, value)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_TASK_TYPE", "task_type", type_id, type_in.model_dump(exclude_unset=True)
    )
    await db.commit()
    await db.refresh(task_type)
    return task_type


@router.delete("/task-types/{type_id}", status_code=204)
async def delete_task_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить тип задачи."""
    require_admin(current_user)
    task_type = await db.get(TaskType, type_id)
    if not task_type:
        raise HTTPException(status_code=404, detail="Тип задачи не найден")
    
    # Проверка на использование в задачах
    from app.models.task import Task
    check = await db.execute(select(Task).where(Task.type_id == type_id).limit(1))
    if check.scalars().first():
         raise HTTPException(status_code=400, detail="Нельзя удалить тип, который используется в задачах. Сначала снимите его использование.")

    await db.delete(task_type)
    await db.commit()

# ==================== TASK STATUSES ====================

@router.post("/task-statuses", response_model=TaskStatusResponse, status_code=201)
async def create_task_status(
    status_in: TaskStatusCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новый статус задачи."""
    require_admin(current_user)
    from app.models.task import TaskStatus
    task_status = TaskStatus(**status_in.model_dump())
    db.add(task_status)
    await db.commit()
    await db.refresh(task_status)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_TASK_STATUS", "task_status", task_status.id, status_in.model_dump()
    )
    return task_status

@router.get("/task-statuses", response_model=List[TaskStatusResponse])
async def list_task_statuses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех статусов задач."""
    require_admin(current_user)
    from app.models.task import TaskStatus
    result = await db.execute(select(TaskStatus).order_by(TaskStatus.sort_order))
    return result.scalars().all()

@router.patch("/task-statuses/{status_id}", response_model=TaskStatusResponse)
async def update_task_status(
    status_id: int,
    status_in: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить статус задачи."""
    require_admin(current_user)
    from app.models.task import TaskStatus
    task_status = await db.get(TaskStatus, status_id)
    if not task_status:
        raise HTTPException(status_code=404, detail="Статус задачи не найден")
    
    for key, value in status_in.model_dump(exclude_unset=True).items():
        setattr(task_status, key, value)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_TASK_STATUS", "task_status", status_id, status_in.model_dump(exclude_unset=True)
    )
    await db.commit()
    await db.refresh(task_status)
    return task_status

@router.delete("/task-statuses/{status_id}", status_code=204)
async def delete_task_status(
    status_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить статус задачи."""
    require_admin(current_user)
    from app.models.task import TaskStatus
    task_status = await db.get(TaskStatus, status_id)
    if not task_status:
        raise HTTPException(status_code=404, detail="Статус задачи не найден")
    
    # Проверка на использование в задачах
    from app.models.task import Task
    check = await db.execute(select(Task).where(Task.status_id == status_id).limit(1))
    if check.scalars().first():
         raise HTTPException(status_code=400, detail="Нельзя удалить статус, который используется в задачах.")

    await db.delete(task_status)
    await db.commit()


# ==================== JOB POSITIONS ====================

@router.post("/positions", response_model=JobPositionResponse, status_code=201)
async def create_job_position(
    pos_in: JobPositionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую должность."""
    require_admin(current_user)
    position = JobPosition(**pos_in.model_dump())
    new_pos = await org_repo.create_job_position(db, position)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_POSITION", "position", new_pos.id, {"name": new_pos.name}
    )
    await db.commit()
    return new_pos


@router.get("/positions", response_model=List[JobPositionResponse])
async def list_job_positions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех должностей."""
    require_admin(current_user)
    return await org_repo.get_job_positions(db)


@router.get("/positions/hierarchy", response_model=List[HierarchyNodeResponse])
async def get_positions_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить иерархию должностей с привязанными пользователями."""
    require_admin(current_user)
    
    # Загружаем ВСЕ должности и ВСЕХ привязанных пользователей с их данными
    result = await db.execute(
        select(JobPosition).options(
            selectinload(JobPosition.department).selectinload(Department.manager).options(
                selectinload(User.department),
                selectinload(User.job_position),
                selectinload(User.role_obj).selectinload(Role.permissions)
            ),
            selectinload(JobPosition.users).selectinload(User.department),
            selectinload(JobPosition.users).selectinload(User.job_position),
            selectinload(JobPosition.users).selectinload(User.role_obj).selectinload(Role.permissions)
        )
    )
    all_positions = result.scalars().all()
    
    from collections import defaultdict
    by_parent = defaultdict(list)
    for p in all_positions:
        by_parent[p.parent_id].append(p)
        
    def build_tree(parent_id):
        tree = []
        for p in by_parent[parent_id]:
            node = HierarchyNodeResponse(
                id=p.id,
                name=p.name,
                parent_id=p.parent_id,
                department_id=p.department_id,
                users=[UserResponse.model_validate(u) for u in p.users],
                sub_positions=build_tree(p.id)
            )
            tree.append(node)
        return tree
        
    return build_tree(None)


@router.patch("/positions/{pos_id}", response_model=JobPositionResponse)
async def update_job_position(
    pos_id: int,
    pos_in: JobPositionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить должность."""
    require_admin(current_user)
    pos = await org_repo.get_job_position_by_id(db, pos_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    
    updated_pos = await org_repo.update_job_position(db, pos, pos_in.model_dump(exclude_unset=True))
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_POSITION", "position", pos_id, pos_in.model_dump(exclude_unset=True)
    )
    await db.commit()
    return updated_pos


@router.delete("/positions/{pos_id}", status_code=204)
async def delete_job_position(
    pos_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить должность."""
    require_admin(current_user)
    pos = await org_repo.get_job_position_by_id(db, pos_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    await org_repo.delete_job_position(db, pos)
    await audit_repo.create_audit_log(
        db, current_user.id, "DELETE_POSITION", "position", pos_id, {"name": pos.name}
    )
    await db.commit()

@router.post("/positions/{pos_id}/permissions")
async def sync_position_permissions(
    pos_id: int,
    sync_data: PositionPermissionsSync,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Синхронизировать набор прав для конкретной должности."""
    require_admin(current_user)
    position = await org_repo.sync_position_permissions(db, pos_id, sync_data.permission_ids)
    if not position:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    
    await audit_repo.create_audit_log(
        db, current_user.id, "SYNC_POSITION_PERMISSIONS", "position", pos_id, 
        {"permission_ids": sync_data.permission_ids}
    )
    await db.commit()
    return {"status": "success"}


# ==================== ROLES ====================

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список ролей со всеми их разрешениями."""
    require_admin(current_user)
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions))
    )
    return result.scalars().all()


@router.get("/permissions/list")
async def list_all_permissions(
    current_user: User = Depends(get_current_user)
):
    """Получить список всех доступных в системе модульных прав, сгруппированных по категориям."""
    require_admin(current_user)
    from app.core.permissions import PERMISSION_GROUPS
    return PERMISSION_GROUPS


@router.get("/permissions/all", response_model=List[PermissionResponse])
async def get_all_raw_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Плоский список всех разрешений из базы данных."""
    require_admin(current_user)
    result = await db.execute(select(Permission))
    return result.scalars().all()


@router.post("/roles/{role_id}/permissions")
async def sync_role_permissions(
    role_id: int,
    sync_data: RolePermissionsSync,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Синхронизировать набор прав для конкретной роли."""
    require_admin(current_user)
    role = await db.get(Role, role_id, options=[selectinload(Role.permissions)])
    if not role:
        raise HTTPException(status_code=404, detail="Роль не найдена")

    # Получаем новые объекты прав
    if sync_data.permission_ids:
        result = await db.execute(
            select(Permission).where(Permission.id.in_(sync_data.permission_ids))
        )
        new_permissions = result.scalars().all()
        role.permissions = list(new_permissions)
    else:
        role.permissions = []

    await db.commit()
    return {"status": "success"}



# ==================== PROJECTS ====================

@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать проект."""
    require_admin(current_user)
    project = Project(**project_in.model_dump())
    new_project = await org_repo.create_project(db, project)
    
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_PROJECT", "project", new_project.id, {"name": new_project.name}
    )
    await db.commit()
    return new_project


@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех проектов."""
    role = current_user.role_name.lower()
    if role == "admin":
        return await org_repo.get_projects(db)
    
    if role == "manager":
        return await org_repo.get_projects_by_manager(db, current_user.id)
    
    return []


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить проект."""
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if current_user.role_name.lower() != "admin" and project.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для изменения.")

    update_data = project_in.model_dump(exclude_unset=True)
    updated_project = await org_repo.update_project(db, project, update_data)
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_PROJECT", "project", project_id, update_data
    )
    await db.commit()
    return updated_project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить проект."""
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
    """Создать пользователя."""
    require_admin(current_user)
    from app.services.auth import register_user
    new_user = await register_user(db, user_in)
    await user_repo.update_user(db, new_user, {"must_change_password": True})
    await audit_repo.create_audit_log(
        db, current_user.id, "CREATE_USER", "user", new_user.id, {"email": new_user.email}
    )
    await db.commit()
    return new_user


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    search: str | None = None,
    sort_by: str = "id",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 15,
    role: str | None = None,
    department_id: int | None = None,
    company: UserCompany | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список пользователей."""
    require_admin(current_user)
    return await user_repo.get_all_users(
        db, search=search, sort_by=sort_by, sort_order=sort_order,
        page=page, page_size=page_size, role=role,
        department_id=department_id, company=company
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    user_in: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить пользователя."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    updated_user = await user_repo.update_user(db, user, user_in.model_dump(exclude_unset=True))
    await audit_repo.create_audit_log(
        db, current_user.id, "UPDATE_USER_ADMIN", "user", user_id, user_in.model_dump(exclude_unset=True)
    )
    await db.commit()
    return updated_user


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сбросить пароль пользователя на дефолтный (admin123)."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    await user_repo.update_user(db, user, {
        "hashed_password": hash_password("admin123"),
        "must_change_password": True
    })
    
    await audit_repo.create_audit_log(
        db, current_user.id, "RESET_PASSWORD_ADMIN", "user", user_id, {"email": user.email}
    )
    await db.commit()
    return {"detail": "Пароль успешно сброшен на 'admin123'"}


@router.post("/users/{user_id}/reset-2fa")
async def reset_user_2fa(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сбросить 2FA пользователя."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    await user_repo.update_user(db, user, {
        "is_2fa_enabled": False,
        "totp_secret": None
    })
    
    await audit_repo.create_audit_log(
        db, current_user.id, "RESET_2FA_ADMIN", "user", user_id, {"email": user.email}
    )
    await db.commit()
    return {"detail": "2FA успешно отключена для пользователя"}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить пользователя."""
    require_admin(current_user)
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    await user_repo.delete_user(db, user)
    await audit_repo.create_audit_log(
        db, current_user.id, "DELETE_USER", "user", user_id, {"email": user.email}
    )
    await db.commit()


# ==================== SETTINGS ====================

@router.get("/settings", response_model=List[SystemSettingSchema])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список всех настроек."""
    require_admin(current_user)
    result = await db.execute(select(SystemSetting))
    return result.scalars().all()


@router.post("/settings", response_model=SystemSettingSchema)
async def update_setting(
    setting_in: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить или создать настройку."""
    require_admin(current_user)
    setting = await settings_repo.set_setting(db, setting_in.key, setting_in.value)
    return setting


# ==================== MICROSOFT INTEGRATION ====================

@router.get("/ms-users")
async def get_ms_users(
    current_user: User = Depends(get_current_user)
):
    """Получить список пользователей из Microsoft Graph."""
    require_admin(current_user)
    return await ms_graph.get_users()


@router.post("/ms-import")
async def import_ms_users(
    users_to_import: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Импортировать выбранных пользователей из MS в локальную БД."""
    require_admin(current_user)
    imported_count = 0
    
    # Чтобы избежать циклического импорта
    from app.services.auth import register_user
    from app.schemas.user import UserCreateByAdmin
    
    for ms_user in users_to_import:
        email = ms_user.get("mail") or ms_user.get("userPrincipalName")
        if not email:
            continue
            
        # Проверяем, существует ли уже пользователь
        existing = await get_user_by_email(db, email)
        if not existing:
            try:
                # Создаем нового пользователя
                user_in = UserCreateByAdmin(
                    email=email,
                    full_name=ms_user.get("displayName") or email,
                    role="employee",
                    password="ms_imported_" + email.split('@')[0] # Временный пароль (будет изменен или не нужен при SSO)
                )
                await register_user(db, user_in)
                imported_count += 1
            except Exception as e:
                import logging
                logging.error(f"Failed to import MS user {email}: {e}")
                
    await db.commit()
    return {"imported": imported_count}


@router.post("/test-email")
async def test_email(
    current_user: User = Depends(get_current_user)
):
    """Протестировать отправку почты через MS Graph."""
    require_admin(current_user)
    success = await ms_graph.send_email(
        recipient=current_user.email,
        subject="Тест почты Overtime System",
        body_content="<h1>Работает!</h1><p>Система уведомлений по почте настроена корректно.</p>"
    )
    if success:
        return {"message": f"Тестовое письмо отправлено на {current_user.email}"}
    else:
        raise HTTPException(status_code=500, detail="Ошибка при отправке почты. Проверьте настройки MS Graph.")

# ==================== STAGE PERMISSIONS MATRIX ====================

@router.get("/permissions/matrix", response_model=List[StagePermissionResponse])
async def get_permissions_matrix(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить всю матрицу прав доступа к стадиям."""
    require_admin(current_user)
    return await PermissionRepository.get_all_matrix(db)

@router.post("/permissions/sync")
async def sync_stage_permissions(
    sync_data: SyncStagePermissions,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Синхронизировать права доступа для должности или пользователя."""
    require_admin(current_user)
    await PermissionRepository.sync_permissions(
        db, 
        allowed_stage_ids=sync_data.allowed_stage_ids,
        position_id=sync_data.position_id,
        user_id=sync_data.user_id
    )
    return {"status": "success"}
