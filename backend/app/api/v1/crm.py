from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import shutil
import os
from uuid import uuid4

from app.core.database import get_db
from app.api.deps import get_current_user, PermissionChecker
from app.models.user import User
from app.models.crm import Lead, Deal, Counterparty
from app.models import Task
from app.schemas.crm import (
    LeadCreate, LeadUpdate, LeadResponse, 
    DealCreate, DealUpdate, DealResponse,
    CounterpartyCreate, CounterpartyUpdate, CounterpartyResponse,
    TaskCreate, TaskUpdate, TaskResponse
)
from app.schemas.organization import ProjectResponse
from app.models.organization import Project
from app.repositories import crm as crm_repo
from app.repositories import audit as audit_repo
from app.services.bpm_service import BPMService
from app.services.access_service import AccessService
from app.models.bpm import TriggerType

router = APIRouter(prefix="/crm", tags=["crm"])


# --- Counterparties ---
@router.post("/counterparties", response_model=CounterpartyResponse, status_code=201)
async def create_counterparty(
    cp_in: CounterpartyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("crm:counterparties:create"))
):
    cp = Counterparty(**cp_in.model_dump())
    return await crm_repo.create_counterparty(db, cp)

@router.get("/counterparties", response_model=List[CounterpartyResponse])
async def list_counterparties(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("crm:counterparties:read"))
):
    return await crm_repo.get_counterparties(db)

@router.get("/counterparties/{cp_id}", response_model=CounterpartyResponse)
async def get_counterparty(
    cp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("crm:counterparties:read"))
):
    cp = await db.get(Counterparty, cp_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    return cp

@router.patch("/counterparties/{cp_id}", response_model=CounterpartyResponse)
async def update_counterparty(
    cp_id: int,
    cp_in: CounterpartyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("crm:counterparties:update"))
):
    cp = await db.get(Counterparty, cp_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    update_data = cp_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cp, key, value)
    await db.commit()
    await db.refresh(cp)
    return cp


# --- Tasks ---

@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = Task(**task_in.model_dump())
    return await crm_repo.create_task(db, task)

@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    lead_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await crm_repo.get_tasks(db, lead_id, deal_id, project_id)


# --- Leads ---

@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_in: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = Lead(**lead_in.model_dump())
    created_lead = await crm_repo.create_lead(db, lead)
    await audit_repo.create_audit_log(db, current_user.id, "CREATE_LEAD", "LEAD", created_lead.id, lead_in.model_dump())
    
    # Запуск BPM автоматизации
    await BPMService.trigger_event(db, "lead", created_lead.id, TriggerType.ENTITY_CREATED, {"user_id": current_user.id})
    
    await db.commit()
    return await crm_repo.get_lead_by_id(db, created_lead.id)


@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    filters = await AccessService.get_lead_filters(current_user, db)
    return await crm_repo.get_leads(db, filters)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await crm_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    lead_in: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await crm_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    old_stage_id = lead.stage_id
    update_data = lead_in.model_dump(exclude_unset=True)
    new_stage_id = update_data.get("stage_id")
    
    updated_lead = await crm_repo.update_lead(db, lead, update_data)
    
    # Если стадия изменилась - запускаем триггер BPM
    if new_stage_id and new_stage_id != old_stage_id:
        await BPMService.trigger_event(
            db, "lead", lead_id, TriggerType.STAGE_CHANGED, 
            {"new_stage_id": new_stage_id, "old_stage_id": old_stage_id, "user_id": current_user.id}
        )
    
    return updated_lead


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    lead = await crm_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await crm_repo.delete_lead(db, lead)


# --- Deals ---

@router.post("/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_in: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = Deal(**deal_in.model_dump())
    created_deal = await crm_repo.create_deal(db, deal)
    await audit_repo.create_audit_log(db, current_user.id, "CREATE_DEAL", "DEAL", created_deal.id, deal_in.model_dump())
    
    # Запуск BPM автоматизации
    await BPMService.trigger_event(db, "deal", created_deal.id, TriggerType.ENTITY_CREATED, {"user_id": current_user.id})
    
    await db.commit()
    return await crm_repo.get_deal_by_id(db, created_deal.id)


@router.get("/deals", response_model=List[DealResponse])
async def list_deals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    filters = await AccessService.get_deal_filters(current_user, db)
    return await crm_repo.get_deals(db, filters)


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = await crm_repo.get_deal_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: int,
    deal_in: DealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = await crm_repo.get_deal_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    old_stage_id = deal.stage_id
    update_data = deal_in.model_dump(exclude_unset=True)
    new_stage_id = update_data.get("stage_id")
    
    updated_deal = await crm_repo.update_deal(db, deal, update_data)
    
    # Если стадия изменилась - запускаем триггер BPM
    if new_stage_id and new_stage_id != old_stage_id:
        await BPMService.trigger_event(
            db, "deal", deal_id, TriggerType.STAGE_CHANGED, 
            {"new_stage_id": new_stage_id, "old_stage_id": old_stage_id, "user_id": current_user.id}
        )
    
    return updated_deal


# --- Deal Attachments ---

@router.post("/deals/{deal_id}/attachments", response_model=DealResponse)
async def upload_deal_attachment(
    deal_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = await crm_repo.get_deal_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid4()}{file_ext}"
    file_path = f"uploads/deals/{unique_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    from app.models.crm import DealAttachment
    attachment = DealAttachment(
        deal_id=deal_id,
        filename=file.filename,
        file_path=file_path,
        content_type=file.content_type,
        size=file.size
    )
    db.add(attachment)
    await db.commit()
    return await crm_repo.get_deal_by_id(db, deal_id)


@router.delete("/deals/{deal_id}/attachments/{attachment_id}", status_code=204)
async def delete_deal_attachment(
    deal_id: int,
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.crm import DealAttachment
    attachment = await db.get(DealAttachment, attachment_id)
    if not attachment or attachment.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    await db.delete(attachment)
    await db.commit()

# --- Conversion Logic ---

@router.post("/leads/{lead_id}/convert", response_model=DealResponse)
async def convert_lead_to_deal(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await crm_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    deal = Deal(
        title=lead.title,
        description=lead.description,
        lead_id=lead.id,
        counterparty_id=lead.counterparty_id,
        assigned_id=lead.assigned_id,
        status="DISCOVERY"
    )
    db.add(deal)
    lead.status = "CONVERTED"
    
    await audit_repo.create_audit_log(db, current_user.id, "CONVERT_LEAD", "DEAL", deal.id, {"lead_id": lead.id})
    await db.commit()
    return await crm_repo.get_deal_by_id(db, deal.id)


@router.post("/deals/{deal_id}/create-project", response_model=ProjectResponse)
async def create_project_from_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = await crm_repo.get_deal_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    project = Project(
        name=deal.title,
        manager_id=current_user.id,
        deal_id=deal.id,
        status="ACTIVE",
        budget=deal.budget
    )
    db.add(project)
    deal.status = "WON"
    deal.project_id = project.id
    
    await audit_repo.create_audit_log(db, current_user.id, "CREATE_PROJECT_FROM_DEAL", "PROJECT", project.id, {"deal_id": deal.id})
    await db.commit()
    await db.refresh(project)
    return project

@router.get("/deals/{deal_id}/export-quotation")
async def export_deal_quotation(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deal = await crm_repo.get_deal_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    from app.services.report_service import ReportService
    html_content = ReportService.generate_quotation_html(deal)
    
    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename=Quotation_DEAL_{deal_id}.html"
        }
    )

