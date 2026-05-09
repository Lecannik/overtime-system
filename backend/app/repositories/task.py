from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.task import Task, TaskComment


async def create_task(session: AsyncSession, task: Task) -> Task:
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task
async def get_all_tasks(session: AsyncSession) -> list[Task]:
    result = await session.execute(
        select(Task).options(
            selectinload(Task.project),
            selectinload(Task.lead),
            selectinload(Task.deal),
            selectinload(Task.creator),
            selectinload(Task.assigned),
            selectinload(Task.task_status),
            selectinload(Task.task_type),
            selectinload(Task.department),
            selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Task.attachments)
        ).order_by(Task.updated_at.desc())
    )
    return result.scalars().all()


async def get_filtered_tasks(session: AsyncSession, filter_condition) -> list[Task]:
    result = await session.execute(
        select(Task).options(
            selectinload(Task.project),
            selectinload(Task.lead),
            selectinload(Task.deal),
            selectinload(Task.creator),
            selectinload(Task.assigned),
            selectinload(Task.task_status),
            selectinload(Task.task_type),
            selectinload(Task.department),
            selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Task.attachments)
        ).where(filter_condition).order_by(Task.updated_at.desc())
    )
    return result.scalars().all()


async def get_tasks_by_project(session: AsyncSession, project_id: int) -> list[Task]:
    result = await session.execute(
        select(Task).options(
            selectinload(Task.project),
            selectinload(Task.lead),
            selectinload(Task.deal),
            selectinload(Task.creator),
            selectinload(Task.assigned),
            selectinload(Task.task_status),
            selectinload(Task.task_type),
            selectinload(Task.department),
            selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Task.attachments)
        ).where(Task.project_id == project_id).order_by(Task.id)
    )
    return result.scalars().all()


async def get_task_by_id(session: AsyncSession, task_id: int) -> Task | None:
    result = await session.execute(
        select(Task).options(
            selectinload(Task.project),
            selectinload(Task.lead),
            selectinload(Task.deal),
            selectinload(Task.creator),
            selectinload(Task.assigned),
            selectinload(Task.task_status),
            selectinload(Task.task_type),
            selectinload(Task.department),
            selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Task.attachments)
        ).where(Task.id == task_id)
    )
    return result.scalar_one_or_none()


async def update_task(session: AsyncSession, task: Task, update_data: dict) -> Task:
    for key, value in update_data.items():
        if value is not None:
            setattr(task, key, value)
    await session.commit()
    return await get_task_by_id(session, task.id)


async def delete_task(session: AsyncSession, task: Task) -> None:
    await session.delete(task)
    await session.commit()


async def create_comment(session: AsyncSession, comment: TaskComment) -> TaskComment:
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment
