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

    excel_data = await generate_excel_file(data, fake_user, is_personal=False)
    assert excel_data is not None
    assert isinstance(excel_data, io.BytesIO)

    # Прочитаем сгенерированный файл с помощью openpyxl
    wb = openpyxl.load_workbook(excel_data)
    
    # Проверим наличие листов
    sheet_names = wb.sheetnames
    assert "Report" in sheet_names
    assert "Polymedia (<=16ч)" in sheet_names
    
    # Проверим, что на сгруппированном листе есть строка с датой в нужном формате
    ws_poly = wb["Polymedia (<=16ч)"]
    a2_val = ws_poly['A2'].value
    assert "Выгрузил: Иван Иванов" in a2_val
    assert "Дата: " in a2_val
    
    date_part = a2_val.split("Дата: ")[1]
    assert any(day in date_part for day in ["пн.", "вт.", "ср.", "чт.", "пт.", "сб.", "вс."])
