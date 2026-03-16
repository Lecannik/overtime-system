from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Department, Project


# --- Departments ---

async def create_department(session: AsyncSession, department: Department) -> Department:
    """Создать отдел."""
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department


async def get_departments(session: AsyncSession) -> list[Department]:
    """Получить все отделы."""
    result = await session.execute(select(Department).order_by(Department.id))
    return result.scalars().all()


async def get_department_by_id(session: AsyncSession, department_id: int) -> Department | None:
    """Получить отдел по ID."""
    result = await session.execute(select(Department).where(Department.id == department_id))
    return result.scalar_one_or_none()


async def update_department(session: AsyncSession, department: Department, update_data: dict) -> Department:
    """Обновить отдел."""
    for key, value in update_data.items():
        if value is not None:
            setattr(department, key, value)
    await session.commit()
    await session.refresh(department)
    return department


async def delete_department(session: AsyncSession, department: Department) -> None:
    """Удалить отдел."""
    await session.delete(department)
    await session.commit()


# --- Projects ---

async def create_project(session: AsyncSession, project: Project) -> Project:
    """Создать проект."""
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def get_projects(session: AsyncSession) -> list[Project]:
    """Получить все проекты."""
    result = await session.execute(select(Project).order_by(Project.id))
    return result.scalars().all()


async def get_projects_by_manager(session: AsyncSession, manager_id: int) -> list[Project]:
    """Получить проекты, где пользователь является менеджером."""
    result = await session.execute(
        select(Project).where(Project.manager_id == manager_id).order_by(Project.id)
    )
    return result.scalars().all()


async def get_project_by_id(session: AsyncSession, project_id: int) -> Project | None:
    """Получить проект по ID."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def update_project(session: AsyncSession, project: Project, update_data: dict) -> Project:
    """Обновить проект."""
    for key, value in update_data.items():
        if value is not None:
            setattr(project, key, value)
    await session.commit()
    await session.refresh(project)
    return project


async def delete_project(session: AsyncSession, project: Project) -> None:
    """Удалить проект."""
    await session.delete(project)
    await session.commit()
