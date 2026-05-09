from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Project
from app.models.overtime import Overtime, OvertimeStatus
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

class AnalyticsService:
    """
    Сервис для расчета финансовых и операционных показателей проектов.
    Отвечает за вычисление маржинальности, трудозатрат и эффективности.
    """

    @staticmethod
    async def update_project_finances(session: AsyncSession, project_id: int):
        """
        Пересчитывает финансовые показатели конкретного проекта.
        gross_profit = turnover - (labor_cost + extra_costs)
        """
        project = await session.get(Project, project_id)
        if not project:
            return

        # 1. Считаем стоимость всех переработок по проекту (только APPROVED)
        # Для простоты считаем: часы * ставка (добавим поле hourly_rate в User или Project)
        query = (
            select(func.sum(func.extract('epoch', Overtime.end_time - Overtime.start_time) / 3600))
            .where(
                Overtime.project_id == project_id,
                Overtime.status == OvertimeStatus.APPROVED
            )
        )
        result = await session.execute(query)
        total_hours = result.scalar() or 0.0

        # Предположим среднюю стоимость часа (в будущем можно брать из User.hourly_rate)
        avg_hourly_rate = 1500  # RUB
        actual_labor_cost = total_hours * avg_hourly_rate

        # 2. Обновляем показатели проекта
        # turnover (оборот) и labor_cost (базовая работа) берутся из ТЗ/Спецификаций
        project.net_profit = project.turnover - (project.labor_cost + actual_labor_cost + project.aup + project.ntk)
        project.gross_profit = project.turnover - (project.labor_cost + actual_labor_cost)
        
        # Записываем актуальные данные в extra_data для истории
        if not project.extra_data:
            project.extra_data = {}
        
        project.extra_data["calculated_at"] = str(func.now())
        project.extra_data["total_overtime_hours"] = round(total_hours, 2)
        project.extra_data["total_overtime_cost"] = round(actual_labor_cost, 2)

        session.add(project)
        await session.commit()
        logger.info(f"Analytics: Updated finances for project {project.id}")

    @staticmethod
    async def get_company_wide_stats(session: AsyncSession):
        """
        Собирает общую статистику по всей компании.
        Возвращает: общую прибыль, количество активных проектов и суммарные переработки.
        """
        stats = {
            "total_turnover": 0.0,
            "total_profit": 0.0,
            "active_projects_count": 0,
            "total_overtime_hours": 0.0
        }

        # Суммируем по проектам
        query_projects = select(
            func.sum(Project.turnover),
            func.sum(Project.net_profit),
            func.count(Project.id)
        ).where(Project.status == "ACTIVE")
        
        res_p = await session.execute(query_projects)
        turnover, profit, count = res_p.fetchone()
        
        stats["total_turnover"] = turnover or 0.0
        stats["total_profit"] = profit or 0.0
        stats["active_projects_count"] = count or 0

        # Суммируем переработки
        query_ot = select(func.sum(func.extract('epoch', Overtime.end_time - Overtime.start_time) / 3600))
        res_ot = await session.execute(query_ot)
        stats["total_overtime_hours"] = res_ot.scalar() or 0.0

        return stats
