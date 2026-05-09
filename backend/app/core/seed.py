from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.crm import CRMStage
from app.models.user import Role, Permission
from app.models.task import TaskType
from app.models.bpm import BPMWorkflow, BPMTrigger, BPMAction, TriggerType, ActionType

async def seed_bpm_workflows(db: AsyncSession):
    """
    Создает базовые правила автоматизации BPM.
    """
    # Проверяем наличие воркфлоу
    res = await db.execute(select(BPMWorkflow).where(BPMWorkflow.name == "Распределение лидов"))
    if res.scalars().first():
        return
    
    wf = BPMWorkflow(
        name="Распределение лидов",
        entity_type="lead",
        description="Авто-задача руководителю продаж при создании лида"
    )
    db.add(wf)
    await db.flush()
    
    trigger = BPMTrigger(
        workflow_id=wf.id,
        type=TriggerType.ENTITY_CREATED
    )
    
    action = BPMAction(
        workflow_id=wf.id,
        type=ActionType.CREATE_TASK,
        params={
            "title": "Распределить лид: {title}",
            "description": "Поступил новый лид. Необходимо проверить и назначить ответственного менеджера.",
            "assigned_position": "Руководитель отдела продаж",
            "priority": "HIGH"
        }
    )
    db.add_all([trigger, action])
    await db.commit()

async def seed_task_types(db: AsyncSession):
    """
    Инициализация базовых типов задач.
    """
    result = await db.execute(select(TaskType))
    if result.scalars().first():
        return
    
    types = [
        TaskType(name="Звонок", color="#10b981", icon="Phone"),
        TaskType(name="Встреча", color="#8b5cf6", icon="Users"),
        TaskType(name="ТЗ", color="#f59e0b", icon="FileText"),
        TaskType(name="Расчет", color="#3b82f6", icon="Calculator"),
        TaskType(name="Закупка", color="#06b6d4", icon="ShoppingCart"),
        TaskType(name="Проектирование", color="#6366f1", icon="PenTool"),
        TaskType(name="Сборка", color="#ec4899", icon="Tool"),
        TaskType(name="Другое", color="#94a3b8", icon="MoreHorizontal"),
    ]
    
    db.add_all(types)
    await db.commit()

async def seed_task_statuses(db: AsyncSession):
    """
    Инициализация базовых статусов задач.
    """
    from app.models.task import TaskStatus
    result = await db.execute(select(TaskStatus))
    if result.scalars().first():
        return
        
    statuses = [
        TaskStatus(name="В очереди", color="#94a3b8", sort_order=1),
        TaskStatus(name="В работе", color="#3b82f6", sort_order=2),
        TaskStatus(name="На проверке", color="#f59e0b", sort_order=3),
        TaskStatus(name="Завершено", color="#10b981", sort_order=4),
        TaskStatus(name="Отменено", color="#ef4444", sort_order=5),
    ]
    db.add_all(statuses)
    await db.commit()

async def seed_crm_stages(db: AsyncSession):
    """
    Инициализация базовых стадий CRM.
    """
    # Проверяем, есть ли уже стадии
    result = await db.execute(select(CRMStage))
    if result.scalars().first():
        return
    
    stages = [
        # Leads
        CRMStage(name="Новый лид", module="LEAD", color="#34d399", sort_order=1),
        CRMStage(name="Переговоры", module="LEAD", color="#fbbf24", sort_order=2),
        CRMStage(name="Квалифицирован", module="LEAD", color="#60a5fa", sort_order=3),
        
        # Deals
        CRMStage(name="Первичный контакт", module="DEAL", color="#94a3b8", sort_order=1),
        CRMStage(name="ТКП отправлено", module="DEAL", color="#f59e0b", sort_order=2),
        CRMStage(name="Согласование договора", module="DEAL", color="#8b5cf6", sort_order=3),
        CRMStage(name="Контракт подписан", module="DEAL", color="#10b981", sort_order=4),
        
        # Projects
        CRMStage(name="Инициация", module="PROJECT", color="#6366f1", sort_order=1),
        CRMStage(name="Проектирование", module="PROJECT", color="#ec4899", sort_order=2),
        CRMStage(name="Закупки", module="PROJECT", color="#f97316", sort_order=3),
        CRMStage(name="Сборка/Монтаж", module="PROJECT", color="#06b6d4", sort_order=4),
        CRMStage(name="Завершено", module="PROJECT", color="#10b981", sort_order=5),
    ]
    
    db.add_all(stages)
    await db.commit()

async def seed_roles_and_permissions(db: AsyncSession):
    """
    Создает базовые роли и права доступа.
    """
    # Проверяем наличие ролей
    role_check = await db.execute(select(Role))
    if role_check.scalars().first():
        return

    # 1. Права
    permissions_list = [
        Permission(name="view_crm", description="Просмотр CRM"),
        Permission(name="manage_leads", description="Управление лидами"),
        Permission(name="manage_deals", description="Управление сделками"),
        Permission(name="view_analytics", description="Просмотр аналитики"),
        Permission(name="admin_users", description="Управление пользователями"),
        Permission(name="approve_overtimes", description="Утверждение переработок"),
    ]
    db.add_all(permissions_list)
    await db.flush() # Получаем ID прав

    # Мапа для удобства
    p = {perm.name: perm for perm in permissions_list}

    # 2. Роли
    admin_role = Role(name="admin", description="Администратор системы")
    admin_role.permissions = [p["view_crm"], p["manage_leads"], p["manage_deals"], p["view_analytics"], p["admin_users"], p["approve_overtimes"]]

    manager_role = Role(name="manager", description="Руководитель проекта")
    manager_role.permissions = [p["view_crm"], p["manage_leads"], p["manage_deals"], p["view_analytics"], p["approve_overtimes"]]

    employee_role = Role(name="employee", description="Сотрудник")
    employee_role.permissions = [p["view_crm"]]

    db.add_all([admin_role, manager_role, employee_role])
    await db.commit()

    # 3. Привязка ролей к существующим пользователям (миграция)
    from app.models.user import User
    for role_name in ["admin", "manager", "employee"]:
        role_obj = await db.execute(select(Role).where(Role.name == role_name))
        role_obj = role_obj.scalar_one()
        
        # Обновляем пользователей, у которых role (текст) совпадает, а role_id еще не задан
        users_to_update = await db.execute(
            select(User).where(User.role == role_name, User.role_id == None)
        )
        for user in users_to_update.scalars().all():
            user.role_id = role_obj.id
    
    await db.commit()
