from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.organization import Department, Project, JobPosition
from app.models.user import User, Permission, Role
from app.models.task import Task, TaskComment
from app.models.overtime import Overtime


# --- Departments ---

async def create_department(session: AsyncSession, department: Department) -> Department:
    """Создать отдел."""
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department


async def get_departments(session: AsyncSession) -> list[Department]:
    """Получить все отделы."""
    result = await session.execute(
        select(Department)
        .options(
            selectinload(Department.manager).selectinload(User.department),
            selectinload(Department.manager).selectinload(User.job_position),
            selectinload(Department.manager).selectinload(User.role_obj).selectinload(Role.permissions)
        )
        .order_by(Department.id)
    )
    return result.scalars().all()


async def get_department_by_id(session: AsyncSession, department_id: int) -> Department | None:
    """Получить отдел по ID."""
    result = await session.execute(
        select(Department)
        .options(
            selectinload(Department.manager).selectinload(User.department),
            selectinload(Department.manager).selectinload(User.job_position),
            selectinload(Department.manager).selectinload(User.role_obj)
        )
        .where(Department.id == department_id)
    )
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


# --- Job Positions ---

async def create_job_position(session: AsyncSession, position: JobPosition) -> JobPosition:
    """Создать должность."""
    session.add(position)
    await session.commit()
    await session.refresh(position)
    return position


async def get_job_positions(session: AsyncSession) -> list[JobPosition]:
    """Получить все должности с подгрузкой отдела (и менеджера) и прав доступа."""
    result = await session.execute(
        select(JobPosition)
        .options(
            selectinload(JobPosition.department).selectinload(Department.manager).options(
                selectinload(User.department),
                selectinload(User.job_position),
                selectinload(User.role_obj).selectinload(Role.permissions)
            ),
            selectinload(JobPosition.permissions)
        )
        .order_by(JobPosition.id)
    )
    return result.scalars().all()


async def get_job_position_by_id(session: AsyncSession, position_id: int) -> JobPosition | None:
    """Получить должность по ID с подгрузкой отдела (и его менеджера) и прав."""
    result = await session.execute(
        select(JobPosition)
        .options(
            selectinload(JobPosition.department).selectinload(Department.manager).options(
                selectinload(User.department),
                selectinload(User.job_position),
                selectinload(User.role_obj).selectinload(Role.permissions)
            ),
            selectinload(JobPosition.permissions)
        )
        .where(JobPosition.id == position_id)
    )
    return result.scalar_one_or_none()


async def update_job_position(session: AsyncSession, position: JobPosition, update_data: dict) -> JobPosition:
    """Обновить должность."""
    for key, value in update_data.items():
        if value is not None:
            setattr(position, key, value)
    await session.commit()
    await session.refresh(position)
    return position


async def delete_job_position(session: AsyncSession, position: JobPosition) -> None:
    """Удалить должность."""
    await session.delete(position)
    await session.commit()

async def sync_position_permissions(session: AsyncSession, position_id: int, permission_ids: list[int]) -> JobPosition:
    """Синхронизирует список прав для должности."""
    position = await get_job_position_by_id(session, position_id)
    if not position:
        return None
        
    # Получаем новые объекты прав
    if permission_ids:
        result = await session.execute(select(Permission).where(Permission.id.in_(permission_ids)))
        new_permissions = result.scalars().all()
    else:
        new_permissions = []
        
    # Обновляем связь
    position.permissions = new_permissions
    await session.commit()
    await session.refresh(position)
    return position


# --- Projects ---

async def create_project(session: AsyncSession, project: Project) -> Project:
    """Создать проект."""
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def get_projects(session: AsyncSession, user: User) -> list[Project]:
    """Получить все проекты с учетом прав доступа."""
    from app.services.access_service import AccessService
    filters = await AccessService.get_project_filters(user, session)
    
    query = select(Project).options(
        selectinload(Project.manager).selectinload(User.department),
        selectinload(Project.manager).selectinload(User.job_position),
        selectinload(Project.gip).selectinload(User.department),
        selectinload(Project.gip).selectinload(User.job_position),
        selectinload(Project.stage),
        selectinload(Project.tasks).selectinload(Task.assigned),
        selectinload(Project.tasks).selectinload(Task.task_status),
        selectinload(Project.tasks).selectinload(Task.task_type),
        selectinload(Project.tasks).selectinload(Task.attachments),
        selectinload(Project.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
        selectinload(Project.tasks).selectinload(Task.department),
        selectinload(Project.tasks).selectinload(Task.creator),
        selectinload(Project.overtimes).selectinload(Overtime.user),
        selectinload(Project.attachments)
    )
    
    for f in filters:
        query = query.where(f)
        
    result = await session.execute(query.order_by(Project.id.desc()))
    return result.scalars().all()


async def get_projects_by_manager(session: AsyncSession, manager_id: int) -> list[Project]:
    """Получить проекты, где пользователь является менеджером."""
    result = await session.execute(
        select(Project)
        .options(
            selectinload(Project.manager).selectinload(User.department),
            selectinload(Project.manager).selectinload(User.job_position),
            selectinload(Project.gip).selectinload(User.department),
            selectinload(Project.gip).selectinload(User.job_position),
            selectinload(Project.stage)
        )
        .where(Project.manager_id == manager_id)
        .order_by(Project.id)
    )
    return result.scalars().all()


async def get_project_by_id(session: AsyncSession, project_id: int) -> Project | None:
    """
    Получить детальную информацию о проекте со всеми связями.
    Используется для страницы 'Карточка проекта'.
    """
    result = await session.execute(
        select(Project).options(
            selectinload(Project.manager).selectinload(User.department),
            selectinload(Project.manager).selectinload(User.job_position),
            selectinload(Project.gip).selectinload(User.department),
            selectinload(Project.gip).selectinload(User.job_position),
            selectinload(Project.stage),
            # Подгружаем задачи и их исполнителей
            selectinload(Project.tasks).selectinload(Task.assigned),
            selectinload(Project.tasks).selectinload(Task.task_status),
            selectinload(Project.tasks).selectinload(Task.task_type),
            selectinload(Project.tasks).selectinload(Task.attachments),
            selectinload(Project.tasks).selectinload(Task.comments).selectinload(TaskComment.author),
            selectinload(Project.tasks).selectinload(Task.department),
            selectinload(Project.tasks).selectinload(Task.creator),
            # Подгружаем переработки и сотрудников
            selectinload(Project.overtimes).selectinload(Overtime.user),
            selectinload(Project.attachments)
        ).where(Project.id == project_id)
    )
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
