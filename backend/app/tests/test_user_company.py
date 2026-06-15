import pytest
from app.models.user import UserCompany, UserCompanyType

def test_user_company_type():
    """
    Тестирование кастомного типа UserCompanyType.
    
    Проверяет, что Enum-значения правильно преобразуются для базы данных
    (AJ_techCom -> 'AJ-techCom') и обратно при чтении.
    """
    company_type = UserCompanyType()

    # Тестирование process_bind_param (запись в БД)
    assert company_type.process_bind_param(UserCompany.Polymedia, None) == "Polymedia"
    assert company_type.process_bind_param(UserCompany.AJ_techCom, None) == "AJ-techCom"
    assert company_type.process_bind_param(None, None) is None
    assert company_type.process_bind_param("AJ-techCom", None) == "AJ-techCom"

    # Тестирование process_result_value (чтение из БД)
    assert company_type.process_result_value("Polymedia", None) == UserCompany.Polymedia
    assert company_type.process_result_value("AJ-techCom", None) == UserCompany.AJ_techCom
    assert company_type.process_result_value(None, None) is None
    assert company_type.process_result_value("UnknownCompany", None) == "UnknownCompany"
