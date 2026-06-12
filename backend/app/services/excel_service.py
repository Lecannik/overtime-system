import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime, timezone
from app.models.user import User, UserRole
from app.core.config import settings

def format_date_with_weekday(dt: datetime) -> str:
    """Форматирует дату в формат: день_недели. день.месяц.год (например: пн. 15.06.2026)"""
    weekdays = ["пн.", "вт.", "ср.", "чт.", "пт.", "сб.", "вс."]
    wd = weekdays[dt.weekday()]
    return f"{wd} {dt.strftime('%d.%m.%Y')}"

def get_local_date(dt_val) -> datetime | None:
    """Извлекает локальную дату из datetime или ISO строки."""
    if pd.isna(dt_val) or not dt_val:
        return None
    if isinstance(dt_val, str):
        try:
            dt = datetime.fromisoformat(dt_val.replace('Z', '+00:00'))
        except ValueError:
            try:
                dt = datetime.strptime(dt_val, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                return None
    else:
        dt = dt_val
        
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(settings.tz_info).date()

async def generate_excel_file(
    data: list,
    current_user: User,
    is_personal: bool = False,
    start_date = None,
    end_date = None
) -> io.BytesIO:
    """Генерирует Excel-файл и возвращает его как BytesIO объект."""
    if not data:
        return None

    # Формируем строку периода для вывода на листах отчета
    period_str = ""
    if start_date or end_date:
        start_fmt = format_date_with_weekday(start_date) if start_date else None
        end_fmt = format_date_with_weekday(end_date) if end_date else None
        
        if start_fmt and end_fmt:
            if start_date == end_date:
                period_str = f"Период: {start_fmt}"
            else:
                period_str = f"Период: {start_fmt} — {end_fmt}"
        elif start_fmt:
            period_str = f"Период: с {start_fmt}"
        elif end_fmt:
            period_str = f"Период: по {end_fmt}"
    else:
        local_now = datetime.now(settings.tz_info)
        period_str = f"Дата: {format_date_with_weekday(local_now)}"

    df = pd.DataFrame(data)
    
    # Колонки и их порядок
    cols_order = ["id", "employee", "project", "start_time", "end_time", "hours", "approved_hours", "description", "status"]
    # Проверяем наличие всех колонок в data, если нет - добавляем пустые
    for col in cols_order:
        if col not in df.columns:
            df[col] = None

    df = df[cols_order]
    
    # Форматирование дат к локальному часовому поясу (Asia/Almaty) с безопасной обработкой None
    def format_datetime_local(dt):
        if pd.isna(dt) or dt is None:
            return ""
        if isinstance(dt, str):
            try:
                dt = pd.to_datetime(dt)
            except Exception:
                return dt
        if hasattr(dt, "to_pydatetime"):
            dt = dt.to_pydatetime()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(settings.tz_info).strftime('%d.%m.%Y %H:%M')

    df['start_time'] = df['start_time'].apply(format_datetime_local)
    df['end_time'] = df['end_time'].apply(format_datetime_local)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for index, row in df.iterrows():
            # Логика заполнения одобренных часов
            if row['status'] == "Подтверждено":
                if pd.isna(row['approved_hours']) or row['approved_hours'] is None:
                    df.at[index, 'approved_hours'] = row['hours']
            else:
                df.at[index, 'approved_hours'] = 0.0
            
            if pd.isna(row['hours']) or row['hours'] is None:
                df.at[index, 'hours'] = 0.0

        # Переименование колонок
        df_export = df.rename(columns={
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

        df_export.to_excel(writer, index=False, sheet_name='Report', startrow=3)
        worksheet = writer.sheets['Report']
        
        # Заголовок
        title_text = "ПЕРСОНАЛЬНЫЙ ОТЧЕТ" if is_personal else "ОТЧЕТ ПО ПЕРЕРАБОТКАМ"
        title = f"{title_text} — {period_str}"
        worksheet.merge_cells('A1:I1')
        worksheet['A1'] = title
        worksheet['A1'].font = Font(size=16, bold=True, color="1e40af")
        worksheet['A1'].alignment = Alignment(horizontal='center')
        
        worksheet.merge_cells('A2:I2')
        worksheet['A2'] = f"Выгрузил: {current_user.full_name}"
        worksheet['A2'].alignment = Alignment(horizontal='center')

        # Стилизация
        header_fill = PatternFill(start_color="1e40af", end_color="1e40af", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

        for col in range(1, 10):
            cell = worksheet.cell(row=4, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal='center')

        for row_idx in range(5, 5 + len(df)):
            for col_idx in range(1, 10):
                cell = worksheet.cell(row=row_idx, column=col_idx)
                cell.border = border
                if col_idx in [6, 7]:
                    cell.alignment = Alignment(horizontal='center')

        # Ширина колонок
        for i, col_name in enumerate(df_export.columns):
            column_letter = get_column_letter(i + 1)
            column_data = df_export[col_name].astype(str)
            max_len = max(column_data.map(len).max(), len(str(col_name))) + 4
            worksheet.column_dimensions[column_letter].width = min(max_len, 50)

        # Итого
        total_row = 5 + len(df)
        worksheet.cell(row=total_row, column=5).value = "ИТОГО:"
        worksheet.cell(row=total_row, column=5).font = Font(bold=True)
        worksheet.cell(row=total_row, column=5).border = border
        
        worksheet.cell(row=total_row, column=6).value = df['hours'].sum()
        worksheet.cell(row=total_row, column=6).font = Font(bold=True)
        worksheet.cell(row=total_row, column=6).border = border
        
        worksheet.cell(row=total_row, column=7).value = df['approved_hours'].sum()
        worksheet.cell(row=total_row, column=7).font = Font(bold=True, color="15803d")
        worksheet.cell(row=total_row, column=7).border = border
        
        for col_idx in [1, 2, 3, 4, 8, 9]:
            worksheet.cell(row=total_row, column=col_idx).border = border

        # Группировка сотрудников для дополнительных листов (табелей)
        if not is_personal and current_user.role in [UserRole.manager, UserRole.head, UserRole.admin]:
            # Шаг 1: Посчитаем суммарные часы каждого сотрудника для определения листа (>16 или <=16)
            emp_totals = {}
            for item in data:
                emp_name = item.get("employee")
                if not emp_name:
                    continue
                if emp_name not in emp_totals:
                    emp_totals[emp_name] = {
                        "company": item.get("employee_company") or "Polymedia",
                        "total_approved": 0.0
                    }
                if item.get("status") == "Подтверждено":
                    approved = item.get("approved_hours")
                    if approved is None or pd.isna(approved):
                        approved = item.get("hours", 0.0) or 0.0
                    emp_totals[emp_name]["total_approved"] += approved

            # Шаг 2: Сгруппируем детальные записи по (сотрудник, дата)
            emp_daily_stats = {}
            for item in data:
                emp_name = item.get("employee")
                if not emp_name:
                    continue
                emp_date = get_local_date(item.get("start_time"))
                if not emp_date:
                    continue
                    
                key = (emp_name, emp_date)
                if key not in emp_daily_stats:
                    emp_daily_stats[key] = {
                        "employee": emp_name,
                        "date": emp_date,
                        "company": item.get("employee_company") or "Polymedia",
                        "department": item.get("department") or "",
                        "projects": set(),
                        "total_hours": 0.0,
                        "total_approved": 0.0
                    }
                
                stats = emp_daily_stats[key]
                if item.get("project"):
                    stats["projects"].add(item.get("project"))
                stats["total_hours"] += item.get("hours", 0.0) or 0.0
                if item.get("status") == "Подтверждено":
                    approved = item.get("approved_hours")
                    if approved is None or pd.isna(approved):
                        approved = item.get("hours", 0.0) or 0.0
                    stats["total_approved"] += approved

            # Шаг 3: Распределим сгруппированные по дням записи по спискам для листов
            polymedia_gt16 = []
            polymedia_lte16 = []
            ajtech_gt16 = []
            ajtech_lte16 = []
            
            for key, stats in emp_daily_stats.items():
                emp_name = stats["employee"]
                total_approved = emp_totals[emp_name]["total_approved"]
                company = emp_totals[emp_name]["company"]
                
                if total_approved > 16:
                    if company == "Polymedia":
                        polymedia_gt16.append(stats)
                    else:
                        ajtech_gt16.append(stats)
                else:
                    if company == "Polymedia":
                        polymedia_lte16.append(stats)
                    else:
                        ajtech_lte16.append(stats)
            
            polymedia_gt16.sort(key=lambda x: (x["employee"], x["date"]))
            polymedia_lte16.sort(key=lambda x: (x["employee"], x["date"]))
            ajtech_gt16.sort(key=lambda x: (x["employee"], x["date"]))
            ajtech_lte16.sort(key=lambda x: (x["employee"], x["date"]))

            # Функция для генерации и форматирования листа табеля
            def create_timesheet_sheet(sheet_name, title_desc, group_data):
                ws = writer.book.create_sheet(title=sheet_name)
                
                # Заголовок листа
                ws.merge_cells('A1:G1')
                ws['A1'] = f"ТАБЕЛЬ УЧЕТА РАБОЧЕГО ВРЕМЕНИ — {title_desc}"
                ws['A1'].font = Font(size=14, bold=True, color="1e40af")
                ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
                ws.row_dimensions[1].height = 30
                
                ws.merge_cells('A2:G2')
                ws['A2'] = f"Выгрузил: {current_user.full_name} | {period_str}"
                ws['A2'].font = Font(italic=True, size=10, color="4b5563")
                ws['A2'].alignment = Alignment(horizontal='center')
                ws.row_dimensions[2].height = 20

                # Заголовки таблицы
                headers = ["№", "Сотрудник", "Дата", "Отдел", "Проекты", "Запрошено (ч)", "Согласовано (ч)"]
                header_fill = PatternFill(start_color="1e40af", end_color="1e40af", fill_type="solid")
                header_font = Font(color="FFFFFF", bold=True)
                border_thin = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

                ws.row_dimensions[4].height = 25
                for col_idx, h_text in enumerate(headers, 1):
                    cell = ws.cell(row=4, column=col_idx, value=h_text)
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                    cell.border = border_thin

                # Данные
                row_idx = 5
                for idx, row in enumerate(group_data, 1):
                    ws.row_dimensions[row_idx].height = 20
                    ws.cell(row=row_idx, column=1, value=idx).alignment = Alignment(horizontal='center')
                    ws.cell(row=row_idx, column=2, value=row["employee"])
                    
                    # Форматируем дату в нужный формат: пн. 15.06.2026
                    formatted_item_date = format_date_with_weekday(row["date"])
                    ws.cell(row=row_idx, column=3, value=formatted_item_date).alignment = Alignment(horizontal='center')
                    
                    ws.cell(row=row_idx, column=4, value=row["department"])
                    ws.cell(row=row_idx, column=5, value=", ".join(sorted(list(row["projects"]))))
                    
                    ws.cell(row=row_idx, column=6, value=row["total_hours"]).alignment = Alignment(horizontal='center')
                    ws.cell(row=row_idx, column=7, value=row["total_approved"]).alignment = Alignment(horizontal='center')

                    for col_idx in range(1, 8):
                        ws.cell(row=row_idx, column=col_idx).border = border_thin
                    row_idx += 1

                # Итоговая строка
                ws.row_dimensions[row_idx].height = 22
                ws.cell(row=row_idx, column=5, value="ИТОГО:").font = Font(bold=True)
                ws.cell(row=row_idx, column=5).alignment = Alignment(horizontal='right', vertical='center')
                ws.cell(row=row_idx, column=5).border = border_thin
                
                total_req = sum(item["total_hours"] for item in group_data)
                total_app = sum(item["total_approved"] for item in group_data)

                ws.cell(row=row_idx, column=6, value=total_req).font = Font(bold=True)
                ws.cell(row=row_idx, column=6).alignment = Alignment(horizontal='center')
                ws.cell(row=row_idx, column=6).border = border_thin

                ws.cell(row=row_idx, column=7, value=total_app).font = Font(bold=True, color="15803d")
                ws.cell(row=row_idx, column=7).alignment = Alignment(horizontal='center')
                ws.cell(row=row_idx, column=7).border = border_thin

                for col_idx in [1, 2, 3, 4]:
                    ws.cell(row=row_idx, column=col_idx).border = border_thin

                # Ширины колонок
                col_widths = {
                    "A": 6,
                    "B": 30,
                    "C": 18,
                    "D": 25,
                    "E": 40,
                    "F": 15,
                    "G": 15
                }
                for col_letter, width in col_widths.items():
                    ws.column_dimensions[col_letter].width = width

            # Создаем 4 дополнительных листа
            create_timesheet_sheet("Polymedia (>16ч)", "Polymedia (более 16ч)", polymedia_gt16)
            create_timesheet_sheet("Polymedia (<=16ч)", "Polymedia (до 16ч)", polymedia_lte16)
            create_timesheet_sheet("AJ-techCom (>16ч)", "AJ-techCom (более 16ч)", ajtech_gt16)
            create_timesheet_sheet("AJ-techCom (<=16ч)", "AJ-techCom (до 16ч)", ajtech_lte16)

    output.seek(0)
    return output
