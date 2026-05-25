import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from app.models.user import User, UserRole

async def generate_excel_file(
    data: list,
    current_user: User,
    is_personal: bool = False
) -> io.BytesIO:
    """Генерирует Excel-файл и возвращает его как BytesIO объект."""
    if not data:
        return None
        
    df = pd.DataFrame(data)
    
    # Колонки и их порядок
    cols_order = ["id", "employee", "project", "start_time", "end_time", "hours", "approved_hours", "description", "status"]
    # Проверяем наличие всех колонок в data, если нет - добавляем пустые
    for col in cols_order:
        if col not in df.columns:
            df[col] = None

    df = df[cols_order]
    
    # Форматирование дат
    df['start_time'] = pd.to_datetime(df['start_time']).dt.strftime('%d.%m.%Y %H:%M')
    df['end_time'] = pd.to_datetime(df['end_time']).dt.strftime('%d.%m.%Y %H:%M')
    
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
        title = f"{title_text} — {datetime.now().strftime('%d.%m.%Y')}"
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
            employee_stats = {}
            for item in data:
                emp_name = item.get("employee")
                if not emp_name:
                    continue
                
                if emp_name not in employee_stats:
                    employee_stats[emp_name] = {
                        "employee": emp_name,
                        "company": item.get("employee_company") or "Polymedia",
                        "department": item.get("department") or "",
                        "projects": set(),
                        "total_hours": 0.0,
                        "total_approved": 0.0
                    }
                
                stats = employee_stats[emp_name]
                if item.get("project"):
                    stats["projects"].add(item.get("project"))
                
                stats["total_hours"] += item.get("hours", 0.0) or 0.0
                
                # Добавляем одобренные часы (если статус "Подтверждено")
                if item.get("status") == "Подтверждено":
                    approved = item.get("approved_hours")
                    if approved is None or pd.isna(approved):
                        stats["total_approved"] += item.get("hours", 0.0) or 0.0
                    else:
                        stats["total_approved"] += approved

            for emp_name, stats in employee_stats.items():
                stats["projects"] = sorted(list(stats["projects"]))

            # Разделяем сотрудников по 4 листам
            polymedia_gt16 = []
            polymedia_lte16 = []
            ajtech_gt16 = []
            ajtech_lte16 = []
            
            for emp_name, stats in employee_stats.items():
                comp = stats["company"]
                app_hours = stats["total_approved"]
                if comp == "Polymedia":
                    if app_hours > 16:
                        polymedia_gt16.append(stats)
                    else:
                        polymedia_lte16.append(stats)
                else:  # AJ-techCom or other
                    if app_hours > 16:
                        ajtech_gt16.append(stats)
                    else:
                        ajtech_lte16.append(stats)
            
            polymedia_gt16.sort(key=lambda x: x["employee"])
            polymedia_lte16.sort(key=lambda x: x["employee"])
            ajtech_gt16.sort(key=lambda x: x["employee"])
            ajtech_lte16.sort(key=lambda x: x["employee"])

            # Функция для генерации и форматирования листа табеля
            def create_timesheet_sheet(sheet_name, title_desc, group_data):
                ws = writer.book.create_sheet(title=sheet_name)
                
                # Заголовок листа
                ws.merge_cells('A1:F1')
                ws['A1'] = f"ТАБЕЛЬ УЧЕТА РАБОЧЕГО ВРЕМЕНИ — {title_desc}"
                ws['A1'].font = Font(size=14, bold=True, color="1e40af")
                ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
                ws.row_dimensions[1].height = 30
                
                ws.merge_cells('A2:F2')
                ws['A2'] = f"Выгрузил: {current_user.full_name} | Дата: {datetime.now().strftime('%d.%m.%Y')}"
                ws['A2'].font = Font(italic=True, size=10, color="4b5563")
                ws['A2'].alignment = Alignment(horizontal='center')
                ws.row_dimensions[2].height = 20

                # Заголовки таблицы
                headers = ["№", "Сотрудник", "Отдел", "Проекты", "Запрошено (ч)", "Согласовано (ч)"]
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
                    ws.cell(row=row_idx, column=3, value=row["department"])
                    ws.cell(row=row_idx, column=4, value=", ".join(row["projects"]))
                    
                    ws.cell(row=row_idx, column=5, value=row["total_hours"]).alignment = Alignment(horizontal='center')
                    ws.cell(row=row_idx, column=6, value=row["total_approved"]).alignment = Alignment(horizontal='center')

                    for col_idx in range(1, 7):
                        ws.cell(row=row_idx, column=col_idx).border = border_thin
                    row_idx += 1

                # Итоговая строка
                ws.row_dimensions[row_idx].height = 22
                ws.cell(row=row_idx, column=4, value="ИТОГО:").font = Font(bold=True)
                ws.cell(row=row_idx, column=4).alignment = Alignment(horizontal='right', vertical='center')
                ws.cell(row=row_idx, column=4).border = border_thin
                
                total_req = sum(item["total_hours"] for item in group_data)
                total_app = sum(item["total_approved"] for item in group_data)

                ws.cell(row=row_idx, column=5, value=total_req).font = Font(bold=True)
                ws.cell(row=row_idx, column=5).alignment = Alignment(horizontal='center')
                ws.cell(row=row_idx, column=5).border = border_thin

                ws.cell(row=row_idx, column=6, value=total_app).font = Font(bold=True, color="15803d")
                ws.cell(row=row_idx, column=6).alignment = Alignment(horizontal='center')
                ws.cell(row=row_idx, column=6).border = border_thin

                for col_idx in [1, 2, 3]:
                    ws.cell(row=row_idx, column=col_idx).border = border_thin

                # Ширины колонок
                col_widths = {
                    "A": 6,
                    "B": 30,
                    "C": 25,
                    "D": 40,
                    "E": 15,
                    "F": 15
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
