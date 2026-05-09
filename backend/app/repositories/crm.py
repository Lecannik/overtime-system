from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.crm import Lead, Deal, Counterparty
from app.models.task import Task, TaskComment


# --- Counterparties ---

async def create_counterparty(session: AsyncSession, counterparty: Counterparty) -> Counterparty:
    session.add(counterparty)
    await session.commit()
    await session.refresh(counterparty)
    return counterparty

async def get_counterparties(session: AsyncSession) -> list[Counterparty]:
    result = await session.execute(select(Counterparty).order_by(Counterparty.name))
    return result.scalars().all()

async def get_counterparty_by_id(session: AsyncSession, cp_id: int) -> Counterparty | None:
    result = await session.execute(select(Counterparty).where(Counterparty.id == cp_id))
    return result.scalar_one_or_none()


# --- Tasks ---

async def create_task(session: AsyncSession, task: Task) -> Task:
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task

async def get_tasks(session: AsyncSession, lead_id: int = None, deal_id: int = None, project_id: int = None) -> list[Task]:
    query = select(Task).options(
        selectinload(Task.assigned),
        selectinload(Task.task_status),
        selectinload(Task.task_type),
        selectinload(Task.attachments),
        selectinload(Task.comments).selectinload(TaskComment.author),
        selectinload(Task.department),
        selectinload(Task.creator),
        selectinload(Task.project),
        selectinload(Task.lead),
        selectinload(Task.deal)
    )
    if lead_id:
        query = query.where(Task.lead_id == lead_id)
    if deal_id:
        query = query.where(Task.deal_id == deal_id)
    if project_id:
        query = query.where(Task.project_id == project_id)
    
    result = await session.execute(query.order_by(Task.deadline.asc()))
    return result.scalars().all()


# --- Leads ---

async def create_lead(session: AsyncSession, lead: Lead) -> Lead:
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return lead


async def get_leads(session: AsyncSession, filters: list = None) -> list[Lead]:
    query = select(Lead).options(
        selectinload(Lead.assigned),
        selectinload(Lead.counterparty),
        selectinload(Lead.tasks).selectinload(Task.assigned),
        selectinload(Lead.tasks).selectinload(Task.task_status),
        selectinload(Lead.tasks).selectinload(Task.task_type),
        selectinload(Lead.tasks).selectinload(Task.attachments),
        selectinload(Lead.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
        selectinload(Lead.tasks).selectinload(Task.department),
        selectinload(Lead.tasks).selectinload(Task.creator),
        selectinload(Lead.stage)
    )
    if filters:
        for f in filters:
            query = query.where(f)
            
    result = await session.execute(query.order_by(Lead.id.desc()))
    return result.scalars().all()


async def get_lead_by_id(session: AsyncSession, lead_id: int) -> Lead | None:
    result = await session.execute(
        select(Lead).options(
            selectinload(Lead.assigned),
            selectinload(Lead.counterparty),
            selectinload(Lead.tasks).selectinload(Task.assigned),
            selectinload(Lead.tasks).selectinload(Task.task_status),
            selectinload(Lead.tasks).selectinload(Task.task_type),
            selectinload(Lead.tasks).selectinload(Task.attachments),
            selectinload(Lead.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Lead.tasks).selectinload(Task.department),
            selectinload(Lead.tasks).selectinload(Task.creator),
            selectinload(Lead.stage)
        ).where(Lead.id == lead_id)
    )
    return result.scalar_one_or_none()


async def update_lead(session: AsyncSession, lead: Lead, update_data: dict) -> Lead:
    for key, value in update_data.items():
        if value is not None:
            setattr(lead, key, value)
    await session.commit()
    return await get_lead_by_id(session, lead.id)


async def delete_lead(session: AsyncSession, lead: Lead) -> None:
    await session.delete(lead)
    await session.commit()


# --- Deals ---

async def create_deal(session: AsyncSession, deal: Deal) -> Deal:
    session.add(deal)
    await session.commit()
    await session.refresh(deal)
    return deal


async def get_deals(session: AsyncSession, filters: list = None) -> list[Deal]:
    query = select(Deal).options(
        selectinload(Deal.assigned),
        selectinload(Deal.lead),
        selectinload(Deal.counterparty),
        selectinload(Deal.tasks).selectinload(Task.assigned),
        selectinload(Deal.tasks).selectinload(Task.task_status),
        selectinload(Deal.tasks).selectinload(Task.task_type),
        selectinload(Deal.tasks).selectinload(Task.attachments),
        selectinload(Deal.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
        selectinload(Deal.tasks).selectinload(Task.department),
        selectinload(Deal.tasks).selectinload(Task.creator),
        selectinload(Deal.project),
        selectinload(Deal.stage),
        selectinload(Deal.attachments)
    )
    if filters:
        for f in filters:
            query = query.where(f)
            
    result = await session.execute(query.order_by(Deal.id.desc()))
    return result.scalars().all()


async def get_deal_by_id(session: AsyncSession, deal_id: int) -> Deal | None:
    result = await session.execute(
        select(Deal).options(
            selectinload(Deal.assigned),
            selectinload(Deal.lead),
            selectinload(Deal.counterparty),
            selectinload(Deal.tasks).selectinload(Task.assigned),
            selectinload(Deal.tasks).selectinload(Task.task_status),
            selectinload(Deal.tasks).selectinload(Task.task_type),
            selectinload(Deal.tasks).selectinload(Task.attachments),
            selectinload(Deal.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Deal.tasks).selectinload(Task.department),
            selectinload(Deal.tasks).selectinload(Task.creator),
            selectinload(Deal.project),
            selectinload(Deal.stage),
            selectinload(Deal.attachments)
        ).where(Deal.id == deal_id)
    )
    return result.scalar_one_or_none()


async def update_deal(session: AsyncSession, deal: Deal, update_data: dict) -> Deal:
    for key, value in update_data.items():
        if value is not None:
            setattr(deal, key, value)
    await session.commit()
    return await get_deal_by_id(session, deal.id)


async def delete_deal(session: AsyncSession, deal: Deal) -> None:
    await session.delete(deal)
    await session.commit()
