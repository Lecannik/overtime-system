import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from app.models.user import User

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

    output.seek(0)
    return output


async def generate_finance_report(
    data: list,
    current_user: User
) -> io.BytesIO:
    """Генерирует Excel-отчет по финансам проектов."""
    if not data:
        return None
        
    df = pd.DataFrame(data)
    
    # Колонки: Проект, Стадия, Оборот, ФОТ, Прибыль, Маржа
    cols_order = ["name", "stage", "turnover", "labor_cost", "net_profit"]
    for col in cols_order:
        if col not in df.columns:
            df[col] = 0.0
            
    df = df[cols_order]
    
    # Расчет маржинальности
    df['margin'] = df.apply(lambda x: (x['net_profit'] / x['turnover'] * 100) if x['turnover'] > 0 else 0, axis=1)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_export = df.rename(columns={
            "name": "Проект",
            "stage": "Стадия",
            "turnover": "Оборот (руб.)",
            "labor_cost": "ФОТ (руб.)",
            "net_profit": "Чистая прибыль (руб.)",
            "margin": "Маржинальность (%)"
        })

        df_export.to_excel(writer, index=False, sheet_name='Finance', startrow=3)
        worksheet = writer.sheets['Finance']
        
        # Стилизация заголовка
        title = f"ФИНАНСОВЫЙ ОТЧЕТ ПО ПРОЕКТАМ — {datetime.now().strftime('%d.%m.%Y')}"
        worksheet.merge_cells('A1:F1')
        worksheet['A1'] = title
        worksheet['A1'].font = Font(size=14, bold=True, color="1e40af")
        worksheet['A1'].alignment = Alignment(horizontal='center')
        
        # Заголовки таблицы
        header_fill = PatternFill(start_color="1e40af", end_color="1e40af", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

        for col in range(1, 7):
            cell = worksheet.cell(row=4, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal='center')

        # Данные
        for row_idx in range(5, 5 + len(df)):
            for col_idx in range(1, 7):
                cell = worksheet.cell(row=row_idx, column=col_idx)
                cell.border = border
                if col_idx >= 3: # Числовые колонки
                    cell.alignment = Alignment(horizontal='right')
                    cell.number_format = '#,##0.00'

        # Итоги
        total_row = 5 + len(df)
        worksheet.cell(row=total_row, column=2).value = "ИТОГО:"
        worksheet.cell(row=total_row, column=2).font = Font(bold=True)
        
        for col_idx in [3, 4, 5]:
            total_val = df.iloc[:, col_idx-1].sum()
            cell = worksheet.cell(row=total_row, column=col_idx)
            cell.value = total_val
            cell.font = Font(bold=True)
            cell.number_format = '#,##0.00'
            cell.border = border

        # Средняя маржа
        avg_margin = (df['net_profit'].sum() / df['turnover'].sum() * 100) if df['turnover'].sum() > 0 else 0
        cell = worksheet.cell(row=total_row, column=6)
        cell.value = avg_margin
        cell.font = Font(bold=True)
        cell.number_format = '#,##0.00'
        cell.border = border

    output.seek(0)
    return output
