"""
Модуль содержит эндпоинты для получения аналитики по переработкам.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole, UserCompany
from app.schemas.analytics import AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics, UserAnalytics, ReviewAnalytics
from app.repositories import analytics as analytics_repo

router = APIRouter(prefix="/analytics", tags=["analytics"])
 
 
async def get_analytics_scope(current_user: User = Depends(get_current_user)) -> dict:
    """
    Зависимость для определения области видимости (scope) данных в аналитике.
    Возвращает словарь с фильтрами (manager_id, department_id), которые нужно применить.
    """
    if current_user.role == UserRole.admin:
        return {"manager_id": None, "department_id": None}
    
    if current_user.role == UserRole.manager:
        return {"manager_id": current_user.id, "department_id": None}
    
    if current_user.role == UserRole.head:
        return {"manager_id": None, "department_id": current_user.department_id}
        
    raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера, начальника или админа.")

@router.get("/reviews", response_model=ReviewAnalytics)
async def get_reviews_stats(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Аналитика по качеству согласования (запрошено vs одобрено)."""
    return await analytics_repo.get_review_analytics(db, **scope, start_date=start_date, end_date=end_date)

@router.get("/weekly")
async def get_weekly_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Статистика за текущую неделю для текущего пользователя."""
    return await analytics_repo.get_user_weekly_stats(db, current_user.id)

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    company: UserCompany | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Общая сводка по переработкам (всего часов, заявок и т.д.)."""
    return await analytics_repo.get_analytics_summary(db, **scope, company=company, start_date=start_date, end_date=end_date)


@router.get("/companies")
async def get_companies_comparison(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сравнительный отчет по компаниям (Доступно только Админам)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для администраторов.")
    
    return await analytics_repo.get_company_comparison(db, start_date=start_date, end_date=end_date)

@router.get("/projects", response_model=List[ProjectAnalytics])
async def get_projects_stats(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе проектов."""
    return await analytics_repo.get_project_analytics(db, **scope, start_date=start_date, end_date=end_date)

@router.get("/departments", response_model=List[DepartmentAnalytics])
async def get_departments_stats(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе отделов."""
    # Только админы и главы отделов видят статистику по всем отделам
    # (Хотя get_analytics_scope уже проверил роль, здесь можно уточнить)
    return await analytics_repo.get_department_analytics(db, **scope, start_date=start_date, end_date=end_date)

@router.get("/users", response_model=List[UserAnalytics])
async def get_users_stats(
    project_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    scope: dict = Depends(get_analytics_scope)
):
    """Статистика в разрезе пользователей (с возможностью фильтрации по проекту)."""
    return await analytics_repo.get_user_analytics(db, project_id=project_id, **scope, start_date=start_date, end_date=end_date)

@router.get("/export")
async def export_analytics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: dict = Depends(get_analytics_scope)
):
    """Экспорт данных в Excel."""
    data = await analytics_repo.get_export_data(
        db, 
        **scope,
        start_date=start_date,
        end_date=end_date
    )
    
    if not data:
        raise HTTPException(status_code=404, detail="Нет данных для экспорта")
    
    # Добавляем новые колонки в экспорт
    data_list = []
    for d in data:
        # Для экспорта нам нужно получить объект из БД или рассчитать часы
        # Но в analytics_repo.get_export_data мы уже получаем список словарей.
        # Нужно убедиться, что там есть raw_hours и approved_hours.
        data_list.append(d)
        
    df = pd.DataFrame(data)
    
    # Добавляем расчет raw_hours если его нет
    # В репозитории get_export_data нужно убедиться что эти поля есть.
    
    # Временно: если в репо нет полей, добавлю их здесь (но лучше обновить репо)
    # Позже я обновлю репозиторий.
    
    cols_order = ["id", "employee", "project", "start_time", "end_time", "hours", "approved_hours", "description", "status"]
    df = df[cols_order]
    
    # Форматирование дат для Excel
    df['start_time'] = pd.to_datetime(df['start_time']).dt.strftime('%d.%m.%Y %H:%M')
    df['end_time'] = pd.to_datetime(df['end_time']).dt.strftime('%d.%m.%Y %H:%M')
    
    # Переименование колонок для красоты
    df = df.rename(columns={
        "id": "ID",
        "employee": "Сотрудник",
        "project": "Проект",
        "start_time": "Начало",
        "end_time": "Окончание",
        "hours": "Запрошено",
        "approved_hours": "Согласовано",
        "description": "Описание",
        "status": "Статус"
    })

    # Создание Excel в памяти
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Пишем данные начиная с 4-й строки, чтобы оставить место под заголовок
        df.to_excel(writer, index=False, sheet_name='Overtime Report', startrow=3)
        
        workbook = writer.book
        worksheet = writer.sheets['Overtime Report']
        
        # 1. Стилизация заголовка отчета
        title = f"ОТЧЕТ ПО ПЕРЕРАБОТКАМ — {datetime.now().strftime('%d.%m.%Y')}"
        worksheet.merge_cells('A1:H1')
        worksheet['A1'] = title
        worksheet['A1'].font = Font(size=16, bold=True, color="1e40af")
        worksheet['A1'].alignment = Alignment(horizontal='center')
        
        # Инфо-строка
        worksheet.merge_cells('A2:H2')
        worksheet['A2'] = f"Выгрузил: {current_user.full_name} | Роль: {current_user.role.value}"
        worksheet['A2'].font = Font(size=10, italic=True)
        worksheet['A2'].alignment = Alignment(horizontal='center')

        # 2. Стилизация шапки таблицы (4-я строка)
        header_fill = PatternFill(start_color="1e40af", end_color="1e40af", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        border = Border(
            left=Side(style='thin'), 
            right=Side(style='thin'), 
            top=Side(style='thin'), 
            bottom=Side(style='thin')
        )

        for col in range(1, 9):
            cell = worksheet.cell(row=4, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal='center')

        # 3. Авто-подбор ширины колонок и границы данных
        for i, col_name in enumerate(df.columns):
            column_letter = get_column_letter(i + 1)
            max_length = max(df[col_name].astype(str).map(len).max(), len(col_name)) + 4
            worksheet.column_dimensions[column_letter].width = max_length
            
            # Границы для всех строк данных
            for row in range(5, 5 + len(df)):
                worksheet.cell(row=row, column=i+1).border = border

        # 4. Итоговая строка
        total_row = 5 + len(df)
        worksheet.cell(row=total_row, column=5).value = "ИТОГО ЧАСОВ:"
        worksheet.cell(row=total_row, column=5).font = Font(bold=True)
        worksheet.cell(row=total_row, column=5).alignment = Alignment(horizontal='right')
        
        # Формула суммы для колонки F (6-я колонка - Часы)
        sum_formula = f"=SUM(F5:F{total_row-1})"
        worksheet.cell(row=total_row, column=6).value = sum_formula
        worksheet.cell(row=total_row, column=6).font = Font(bold=True, color="15803d")
        worksheet.cell(row=total_row, column=6).border = border
        worksheet.cell(row=total_row, column=6).alignment = Alignment(horizontal='center')
    
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="overtime_report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
