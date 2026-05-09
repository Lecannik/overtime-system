from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.organization import Project
from app.schemas.organization import ProjectCreate, ProjectUpdate, ProjectResponse
from app.repositories import organization as org_repo
from app.services.bpm_service import BPMService
from app.models.bpm import TriggerType

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список всех проектов с учетом прав доступа.
    """
    return await org_repo.get_projects(db, current_user)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новый проект."""
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    project = Project(**project_in.model_dump())
    new_project = await org_repo.create_project(db, project)
    
    # Запуск BPM автоматизации
    await BPMService.trigger_event(db, "project", new_project.id, TriggerType.ENTITY_CREATED)
    await db.commit()
    
    return new_project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить проект по ID."""
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить информацию о проекте."""
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    old_stage_id = project.stage_id
    update_data = project_in.model_dump(exclude_unset=True)
    new_stage_id = update_data.get("stage_id")
    
    updated_project = await org_repo.update_project(db, project, update_data)
    
    # Если стадия изменилась - запускаем триггер BPM
    if new_stage_id and new_stage_id != old_stage_id:
        await BPMService.trigger_event(
            db, "project", project_id, TriggerType.STAGE_CHANGED, 
            {"new_stage_id": new_stage_id, "old_stage_id": old_stage_id}
        )
    
    return updated_project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить проект."""
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await org_repo.delete_project(db, project)

@router.post("/{project_id}/upload-spec", response_model=ProjectResponse)
async def upload_project_spec(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузить спецификацию и автоматически обновить показатели проекта."""
    import os
    from app.services.excel_parser import ExcelParser
    
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Сохраняем файл
    upload_dir = "uploads/projects"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"project_{project_id}_spec_{file.filename}")
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
        
    # Парсим файл
    finance_data = ExcelParser.parse_project_spec(file_path)
    
    if finance_data:
        updated_project = await org_repo.update_project(db, project, finance_data)
        updated_project.doc_spec_url = f"/api/v1/projects/download-doc/{os.path.basename(file_path)}"
        await db.commit()
        return updated_project
        
    return project


@router.post("/{project_id}/upload-doc")
async def upload_project_document(
    project_id: int,
    doc_type: str,  # spec, tech_spec, schemes, client_export
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузить документ проекта (ТЗ, схемы, выгрузка и т.д.)."""
    import os
    
    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    allowed_types = ["spec", "tech_spec", "schemes", "client_export"]
    if doc_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Тип документа должен быть одним из: {allowed_types}")
    
    upload_dir = "uploads/projects"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"project_{project_id}_{doc_type}_{file.filename}")
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    url_field = f"doc_{doc_type}_url"
    download_url = f"/api/v1/projects/download-doc/{os.path.basename(file_path)}"
    
    update_data = {url_field: download_url}
    await org_repo.update_project(db, project, update_data)
    
    return {
        "filename": file.filename,
        "doc_type": doc_type,
        "url": download_url,
        "size": len(content)
    }


@router.get("/download-doc/{filename}")
async def download_project_doc(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Скачать документ проекта."""
    import os
    from fastapi.responses import FileResponse
    file_path = os.path.join("uploads/projects", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path=file_path, filename=filename)


@router.post("/{project_id}/upload-gantt")
async def upload_gantt_excel(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузить Excel-файл с данными для диаграммы Ганта."""
    import os
    from app.services.excel_parser import ExcelParser

    project = await org_repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Сохраняем файл
    upload_dir = "uploads/projects"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"project_{project_id}_gantt_{file.filename}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Парсим данные Ганта
    gantt_tasks = ExcelParser.parse_gantt_excel(file_path)

    if not gantt_tasks:
        raise HTTPException(
            status_code=400,
            detail="Не удалось распарсить файл. Ожидаемые колонки: Задача/Название, Начало/Старт, Окончание/Конец"
        )

    return {
        "filename": file.filename,
        "tasks_count": len(gantt_tasks),
        "tasks": gantt_tasks
    }

