from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bpm import BPMWorkflow, BPMTrigger, BPMAction, BPMLog
from app.schemas.bpm import (
    BPMWorkflowCreate, BPMWorkflowResponse, BPMLogResponse
)

router = APIRouter(prefix="/bpm", tags=["bpm"])

@router.post("/workflows", response_model=BPMWorkflowResponse, status_code=201)
async def create_workflow(
    wf_in: BPMWorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage BPM")
    
    workflow = BPMWorkflow(
        name=wf_in.name,
        description=wf_in.description,
        is_active=wf_in.is_active,
        entity_type=wf_in.entity_type
    )
    db.add(workflow)
    await db.flush()

    for trig_in in wf_in.triggers:
        trigger = BPMTrigger(
            workflow_id=workflow.id,
            type=trig_in.type,
            params=trig_in.params,
            conditions=trig_in.conditions
        )
        db.add(trigger)
    
    for act_in in wf_in.actions:
        action = BPMAction(
            workflow_id=workflow.id,
            type=act_in.type,
            params=act_in.params,
            sort_order=act_in.sort_order
        )
        db.add(action)
    
    await db.commit()
    await db.refresh(workflow)
    
    # Reload with relationships
    query = (
        select(BPMWorkflow)
        .where(BPMWorkflow.id == workflow.id)
        .options(
            selectinload(BPMWorkflow.triggers),
            selectinload(BPMWorkflow.actions)
        )
    )
    result = await db.execute(query)
    return result.scalar_one()

@router.get("/workflows", response_model=List[BPMWorkflowResponse])
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(BPMWorkflow).options(
        selectinload(BPMWorkflow.triggers),
        selectinload(BPMWorkflow.actions)
    )
    result = await db.execute(query)
    return result.scalars().unique().all()

@router.get("/logs", response_model=List[BPMLogResponse])
async def list_logs(
    entity_type: str | None = None,
    entity_id: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получить историю выполнения автоматизаций. 
    Можно фильтровать по типу и ID сущности для отображения в карточке проекта/сделки.
    """
    query = select(BPMLog)
    
    if entity_type:
        query = query.join(BPMWorkflow).where(BPMWorkflow.entity_type == entity_type)
    if entity_id:
        query = query.where(BPMLog.entity_id == entity_id)
        
    query = query.order_by(BPMLog.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/workflows/{wf_id}", status_code=204)
async def delete_workflow(
    wf_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_name.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage BPM")
    
    wf = await db.get(BPMWorkflow, wf_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await db.delete(wf)
    await db.commit()
