import pytest
from datetime import datetime, timezone
import openpyxl
import io
from app.services.excel_service import format_date_with_weekday, generate_excel_file
from app.models.user import User, UserRole, UserCompany
from app.models.organization import Department

def test_format_date_with_weekday():
    # 12 июня 2026 года - пятница (пт.)
    dt_fri = datetime(2026, 6, 12)
    assert format_date_with_weekday(dt_fri) == "пт. 12.06.2026"

    # 15 июня 2026 года - понедельник (пн.)
    dt_mon = datetime(2026, 6, 15)
    assert format_date_with_weekday(dt_mon) == "пн. 15.06.2026"

    # 14 июня 2026 года - воскресенье (вс.)
    dt_sun = datetime(2026, 6, 14)
    assert format_date_with_weekday(dt_sun) == "вс. 14.06.2026"

@pytest.mark.asyncio
async def test_generate_excel_file():
    # Подготовим фейковые данные для экспорта
    fake_user = User(
        id=1,
        full_name="Иван Иванов",
        email="admin@example.com",
        role=UserRole.admin,
        company=UserCompany.Polymedia,
        is_active=True
    )
    
    data = [
        {
            "id": 1,
            "employee": "Чмиль Никита Павлович",
            "employee_company": "Polymedia",
            "department": "Технический отдел",
            "project": "Test_Projject",
            "start_time": "2026-06-12 18:00:00",
            "end_time": "2026-06-12 21:00:00",
            "hours": 3.0,
            "approved_hours": 3.0,
            "description": "Тестовая переработка",
            "status": "Подтверждено"
        },
        {
            "id": 2,
            "employee": "Дощанов Руслан Аскарович",
            "employee_company": "Polymedia",
            "department": "Отдел программных решений",
            "project": "Внутренний",
            "start_time": "2026-06-12 18:00:00",
            "end_time": "2026-06-12 20:00:00",
            "hours": 2.0,
            "approved_hours": 2.0,
            "description": "Внутренняя работа",
            "status": "Подтверждено"
        }
    ]

    # 1. Проверяем генерацию БЕЗ указания дат (должна выводиться текущая Дата)
    excel_data = await generate_excel_file(data, fake_user, is_personal=False)
    assert excel_data is not None
    assert isinstance(excel_data, io.BytesIO)

    wb = openpyxl.load_workbook(excel_data)
    ws_poly = wb["Polymedia (<=16ч)"]
    a2_val = ws_poly['A2'].value
    assert "Выгрузил: Иван Иванов" in a2_val
    assert "Дата: " in a2_val

    # 2. Проверяем генерацию С указанием периода (должен выводиться Период)
    from datetime import date
    start_d = date(2026, 6, 1)
    end_d = date(2026, 6, 12)
    excel_data_period = await generate_excel_file(
        data, fake_user, is_personal=False, start_date=start_d, end_date=end_d
    )
    
    wb_period = openpyxl.load_workbook(excel_data_period)
    ws_poly_period = wb_period["Polymedia (<=16ч)"]
    a2_period_val = ws_poly_period['A2'].value
    
    # Период: пн. 01.06.2026 — пт. 12.06.2026
    assert "Выгрузил: Иван Иванов" in a2_period_val
    assert "Период: пн. 01.06.2026 — пт. 12.06.2026" in a2_period_val

    # Проверим заголовки таблицы (в строке 4)
    headers = [ws_poly_period.cell(row=4, column=col).value for col in range(1, 8)]
    assert headers == ["№", "Сотрудник", "Дата", "Отдел", "Проекты", "Запрошено (ч)", "Согласовано (ч)"]

    # Проверим, что в третьем столбце первой строки данных (строка 5) выводится дата с днем недели
    date_val = ws_poly_period.cell(row=5, column=3).value
    assert date_val == "пт. 12.06.2026"
