from typing import Any, List
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.organization import Project, Department
from app.models.crm import CRMStage, Lead, Deal
from app.models.permissions import StagePermission

class AccessService:
    """
    Умная фильтрация данных на основе ролей, должностей и стадий (Динамический ABAC).
    """

    @staticmethod
    async def get_project_filters(user: User, db: AsyncSession):
        """
        Возвращает предикаты для SQLAlchemy фильтрации, основываясь на динамической матрице прав.
        """
        if user.role_name.lower() == "admin":
            return []
        
        # Если есть глобальное право на чтение всех проектов
        if "projects:read" in user.permissions:
            return []
            
        # 1. Личный доступ (Менеджер или ГИП - всегда видят свои проекты)
        own_projects = or_(Project.manager_id == user.id, Project.gip_id == user.id)
        
        # 2. Динамический доступ по стадии (из матрицы StagePermission)
        # Ищем стадии, разрешенные для конкретного пользователя или его должности
        perm_query = select(StagePermission.stage_id).where(
            or_(
                StagePermission.user_id == user.id,
                StagePermission.position_id == user.position_id
            ),
            StagePermission.can_view == True
        )
        
        result = await db.execute(perm_query)
        allowed_stage_ids = result.scalars().all()
        
        additional_filters = []
        if allowed_stage_ids:
            # Если в матрице есть разрешенные стадии, добавляем условие
            additional_filters.append(Project.stage_id.in_(allowed_stage_ids))
        
        # Совмещаем: человек видит СВОИ проекты ИЛИ проекты на РАЗРЕШЕННЫХ ему стадиях
        if additional_filters:
            return [or_(own_projects, *additional_filters)]
            
        return [own_projects]

    @staticmethod
    async def get_lead_filters(user: User, db: AsyncSession):
        """Фильтры для лидов."""
        if user.role_name.lower() == "admin":
            return []
        
        # Если есть право видеть всех лидов
        if "crm:leads:read_all" in user.permissions:
            return []
            
        # 1. Личный доступ
        filters = [Lead.assigned_id == user.id]
        
        # 2. Доступ по отделу (если руководитель)
        # Проверяем, является ли пользователь менеджером своего отдела
        from app.models.organization import Department
        dept_query = select(Department.id).where(Department.manager_id == user.id)
        result = await db.execute(dept_query)
        managed_dept_ids = result.scalars().all()
        
        if managed_dept_ids:
            # Видит лиды, где ответственный из его отдела
            from app.models.user import User as UserModel
            dept_leads = Lead.assigned_id.in_(
                select(UserModel.id).where(UserModel.department_id.in_(managed_dept_ids))
            )
            return [or_(filters[0], dept_leads)]
            
        return filters

    @staticmethod
    async def get_deal_filters(user: User, db: AsyncSession):
        """Фильтры для сделок."""
        if user.role_name.lower() == "admin":
            return []
            
        if "crm:deals:read_all" in user.permissions:
            return []
            
        # 1. Личный доступ
        filters = [Deal.assigned_id == user.id]
        
        # 2. Доступ по отделу (если руководитель)
        from app.models.organization import Department
        dept_query = select(Department.id).where(Department.manager_id == user.id)
        result = await db.execute(dept_query)
        managed_dept_ids = result.scalars().all()
        
        if managed_dept_ids:
            from app.models.user import User as UserModel
            dept_deals = Deal.assigned_id.in_(
                select(UserModel.id).where(UserModel.department_id.in_(managed_dept_ids))
            )
            return [or_(filters[0], dept_deals)]
            
        return filters
