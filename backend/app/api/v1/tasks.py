from typing import List, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User
from app.models.task import Task, TaskComment, TaskAttachment, TaskType, TaskStatus
from app.models.organization import Project, Department
from app.api.deps import get_current_user
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskCommentCreate, TaskTypeResponse, TaskStatusResponse
from app.repositories import task as task_repo
from app.repositories.audit import create_audit_log
from app.services import notifications as notif_service
import os
import shutil
from sqlalchemy import select, or_
from app.models.crm import Lead, Deal

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/statuses", response_model=List[TaskStatusResponse])
async def list_task_statuses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список кастомных статусов задач."""
    result = await db.execute(select(TaskStatus).where(TaskStatus.is_active == True).order_by(TaskStatus.sort_order))
    return result.scalars().all()

@router.get("/types", response_model=List[TaskTypeResponse])
async def list_task_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список типов задач доступных для выбора."""
    result = await db.execute(select(TaskType).where(TaskType.is_active == True).order_by(TaskType.name))
    return result.scalars().all()

@router.get("/assignable-users", response_model=List[Any])
async def list_assignable_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список пользователей для назначения задач (доступен всем авторизованным)."""
    # Возвращаем только базовую информацию для безопасности
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.full_name))
    users = result.scalars().all()
    return [{"id": u.id, "full_name": u.full_name, "department_id": u.department_id} for u in users]

@router.post("/", response_model=TaskResponse)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую задачу."""
    task_data = task_in.model_dump()
    
    # Если отдел не указан явно, пытаемся определить по исполнителю
    # Формирование имени по формуле если нужно
    # [Название сущности] - [Тип задачи]
    entity_name = "Задача"
    if task_data.get("project_id"):
        proj = await db.get(Project, task_data["project_id"])
        if proj: entity_name = proj.name
    elif task_data.get("deal_id"):
        deal = await db.get(Deal, task_data["deal_id"])
        if deal: entity_name = deal.title
    elif task_data.get("lead_id"):
        lead = await db.get(Lead, task_data["lead_id"])
        if lead: entity_name = lead.title
        
    type_name = "Другое"
    if task_data.get("type_id"):
        t_type = await db.get(TaskType, task_data["type_id"])
        if t_type: type_name = t_type.name
    
    # Всегда формируем заголовок по формуле, если он не задан или стандартный
    if not task_data.get("title") or task_data.get("title") == "Новая задача":
        task_data["title"] = f"{entity_name} - {type_name}"

    if not task_data.get("department_id") and task_data.get("assigned_id"):
        assigned_user = await db.get(User, task_data["assigned_id"])
        if assigned_user:
            task_data["department_id"] = assigned_user.department_id

    task = Task(**task_data)
    created_task = await task_repo.create_task(db, task)
    
    # Логируем создание
    await create_audit_log(
        db,
        user_id=current_user.id,
        action="CREATE_TASK",
        target_type="task",
        target_id=created_task.id,
        details={
            "title": created_task.title,
            "origin": "lead" if task.lead_id else "deal" if task.deal_id else "project" if task.project_id else "direct"
        }
    )
    
    full_task = await task_repo.get_task_by_id(db, created_task.id)
    
    # Уведомление
    if full_task and full_task.assigned_id:
        assigned_user = await db.get(User, full_task.assigned_id)
        if assigned_user:
            await notif_service.notify_new_task(db, full_task, assigned_user, current_user)
            
    return full_task

@router.get("/", response_model=List[TaskResponse])
async def list_all_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить задачи доступные текущему пользователю."""
    is_admin = current_user.role_name == "admin"
    if is_admin:
        return await task_repo.get_all_tasks(db)
    
    # Сложная фильтрация
    # 1. Задачи назначенные на пользователя или созданные им
    filters = [
        Task.assigned_id == current_user.id,
        Task.creator_id == current_user.id
    ]
    
    # 2. Задачи отдела (если руководитель)
    # Проверяем, является ли пользователь руководителем какого-либо отдела
    dept_result = await db.execute(select(Department).where(Department.manager_id == current_user.id))
    managed_depts = dept_result.scalars().all()
    if managed_depts:
        dept_ids = [d.id for d in managed_depts]
        filters.append(Task.department_id.in_(dept_ids))
        
    # 3. Задачи проектов, лидов или сделок (если менеджер этой сущности)
    
    # Проекты где пользователь в одной из ролей
    project_result = await db.execute(
        select(Project.id).where(or_(
            Project.manager_id == current_user.id, 
            Project.gip_id == current_user.id,
            Project.lead_engineer_id == current_user.id,
            Project.lead_programmer_id == current_user.id
        ))
    )
    my_project_ids = project_result.scalars().all()
    if my_project_ids:
        filters.append(Task.project_id.in_(my_project_ids))
        
    # Сделки где пользователь ответственный
    deal_result = await db.execute(select(Deal.id).where(Deal.assigned_id == current_user.id))
    my_deal_ids = deal_result.scalars().all()
    if my_deal_ids:
        filters.append(Task.deal_id.in_(my_deal_ids))
        
    # Лиды где пользователь ответственный
    lead_result = await db.execute(select(Lead.id).where(Lead.assigned_id == current_user.id))
    my_lead_ids = lead_result.scalars().all()
    if my_lead_ids:
        filters.append(Task.lead_id.in_(my_lead_ids))
    
    # Применяем фильтры через OR
    return await task_repo.get_filtered_tasks(db, or_(*filters))

@router.get("/project/{project_id}", response_model=List[TaskResponse])
async def list_tasks_by_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список задач по проекту."""
    return await task_repo.get_tasks_by_project(db, project_id)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить детали задачи с проверкой прав."""
    task = await task_repo.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверка прав доступа
    is_admin = current_user.role_name == "admin"
    if is_admin:
        return task
        
    is_owner = task.creator_id == current_user.id or task.assigned_id == current_user.id
    
    # Руководитель отдела
    is_dept_head = False
    if task.department_id:
        dept = await db.get(Department, task.department_id)
        if dept and dept.manager_id == current_user.id:
            is_dept_head = True
            
    # Менеджер сущности
    is_entity_manager = False
    if task.project_id:
        proj = await db.get(Project, task.project_id)
        if proj and current_user.id in [proj.manager_id, proj.gip_id, proj.lead_engineer_id, proj.lead_programmer_id]:
            is_entity_manager = True
    elif task.deal_id:
        deal = await db.get(Deal, task.deal_id)
        if deal and deal.assigned_id == current_user.id:
            is_entity_manager = True
    elif task.lead_id:
        lead = await db.get(Lead, task.lead_id)
        if lead and lead.assigned_id == current_user.id:
            is_entity_manager = True
            
    if not (is_owner or is_dept_head or is_entity_manager):
        raise HTTPException(status_code=403, detail="Доступ к этой задаче запрещен")
        
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить информацию о задаче."""
    task = await task_repo.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверка прав: Админ, Создатель или Руководитель отдела этой задачи
    is_admin = current_user.role_name == "admin"
    is_creator = task.creator_id == current_user.id
    
    is_dept_head = False
    if task.department_id:
        dept = await db.get(Department, task.department_id)
        if dept and dept.manager_id == current_user.id:
            is_dept_head = True

    # Менеджер сущности
    is_entity_manager = False
    if task.project_id:
        proj = await db.get(Project, task.project_id)
        if proj and current_user.id in [proj.manager_id, proj.gip_id, proj.lead_engineer_id, proj.lead_programmer_id]:
            is_entity_manager = True
    elif task.deal_id:
        deal = await db.get(Deal, task.deal_id)
        if deal and deal.assigned_id == current_user.id:
            is_entity_manager = True
    elif task.lead_id:
        lead = await db.get(Lead, task.lead_id)
        if lead and lead.assigned_id == current_user.id:
            is_entity_manager = True

    if not (is_admin or is_creator or is_dept_head or is_entity_manager):
        # Обычный исполнитель может только менять статус своей задачи
        if task.assigned_id != current_user.id:
            raise HTTPException(status_code=403, detail="У вас нет прав для редактирования этой задачи")
    
    old_status_id = task.status_id
    old_status_name = task.task_status.name if task.task_status else task.status
    
    old_data = {
        "status_id": task.status_id,
        "assigned_id": task.assigned_id,
        "title": task.title,
        "priority": task.priority
    }
    
    update_data = task_in.model_dump(exclude_unset=True)
    
    # Если меняется исполнитель, обновляем отдел (если не указан явно)
    if "assigned_id" in update_data and "department_id" not in update_data:
        assigned_user = await db.get(User, update_data["assigned_id"])
        if assigned_user:
            update_data["department_id"] = assigned_user.department_id

    await task_repo.update_task(db, task, update_data)
    
    # Перечитываем для уведомлений и связей
    updated_task = await task_repo.get_task_by_id(db, task_id)
    
    # Подготавливаем данные для лога (сериализуем datetime)
    log_changes = {}
    for k, v in update_data.items():
        if isinstance(v, datetime):
            log_changes[k] = v.isoformat()
        else:
            log_changes[k] = v
            
    log_old_values = {}
    for k in update_data:
        if k in old_data:
            val = old_data[k]
            if isinstance(val, datetime):
                log_old_values[k] = val.isoformat()
            else:
                log_old_values[k] = val

    # Логируем изменения
    await create_audit_log(
        db,
        user_id=current_user.id,
        action="UPDATE_TASK",
        target_type="task",
        target_id=task_id,
        details={
            "changes": log_changes,
            "old_values": log_old_values
        }
    )
    
    # Уведомления о смене статуса
    if old_status_id != updated_task.status_id:
        new_status_name = updated_task.task_status.name if updated_task.task_status else "N/A"
        await notif_service.notify_task_status_change(db, updated_task, old_status_name, new_status_name)
    
    # Специальная логика для проектов
    if updated_task.task_status and updated_task.task_status.name:
        status_name = updated_task.task_status.name.upper()
        if "IN PROGRESS" in status_name or "В РАБОТЕ" in status_name:
            if updated_task.project_id:
                project = await db.get(Project, updated_task.project_id)
                if project and not project.gip_id:
                    project.gip_id = current_user.id
                    await db.flush()
        
        if "REVIEW" in status_name or "ПРОВЕРКА" in status_name:
            if updated_task.project_id:
                project = await db.get(Project, updated_task.project_id)
                if project:
                    manager = await db.get(User, project.manager_id)
                    if manager:
                        await notif_service.notify_task_review(db, updated_task, manager)
    
    return updated_task

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить задачу (только админ или создатель)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверка прав (админ или создатель)
    if current_user.role_name != "admin" and task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Логируем удаление
    await create_audit_log(
        db,
        user_id=current_user.id,
        action="DELETE_TASK",
        target_type="task",
        target_id=task_id,
        details={"title": task.title}
    )
    
    await db.delete(task)
    await db.commit()
    return {"status": "ok"}

@router.post("/{task_id}/comments")
async def add_task_comment(
    task_id: int,
    comment_in: TaskCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавить комментарий к задаче."""
    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=comment_in.content
    )
    db.add(comment)
    await db.commit()
    return {"status": "ok"}

@router.post("/{task_id}/attachments")
async def upload_task_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузить вложение к задаче."""
    upload_dir = f"uploads/tasks/{task_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    attachment = TaskAttachment(
        task_id=task_id,
        filename=file.filename,
        file_path=file_path,
        size=os.path.getsize(file_path)
    )
    db.add(attachment)
    await db.commit()
    return {"status": "ok"}

@router.get("/attachments/{attachment_id}")
async def download_task_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Скачать вложение задачи."""
    attachment = await db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File on disk not found")
        
    return FileResponse(
        path=attachment.file_path,
        filename=attachment.filename
    )
