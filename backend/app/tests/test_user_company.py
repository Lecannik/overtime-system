import pytest
from app.models.user import UserCompany, UserCompanyType

@pytest.mark.asyncio
async def test_user_company_type():
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


def test_company_detection_logic():
    """
    Тестирует логику определения компании по домену email.
    """
    def detect_company(email: str) -> UserCompany:
        return UserCompany.AJ_techCom if ("aj-tech" in email.lower() or "ajtech" in email.lower()) else UserCompany.Polymedia

    assert detect_company("employee@aj-tech.kz") == UserCompany.AJ_techCom
    assert detect_company("user@ajtech.com") == UserCompany.AJ_techCom
    assert detect_company("manager@AJ-TECH.RU") == UserCompany.AJ_techCom
    assert detect_company("some.body@ajtech.kz") == UserCompany.AJ_techCom
    assert detect_company("admin@polymedia.kz") == UserCompany.Polymedia
    assert detect_company("user@gmail.com") == UserCompany.Polymedia


@pytest.mark.asyncio
async def test_migrate_user_company_by_email(db_session):
    """
    Тестирует корректность миграции компаний существующих пользователей на основе email доменов.
    """
    from sqlalchemy import select, text
    from app.models.user import User, UserRole

    # Создаем тестовых пользователей с компанией Polymedia по умолчанию
    users_to_create = [
        User(
            email="ivan@aj-tech.kz",
            full_name="Иван Иванов",
            hashed_password="hash",
            role=UserRole.employee,
            company=UserCompany.Polymedia,
            is_active=True
        ),
        User(
            email="petr@ajtech.com",
            full_name="Петр Петров",
            hashed_password="hash",
            role=UserRole.employee,
            company=UserCompany.Polymedia,
            is_active=True
        ),
        User(
            email="sidor@polymedia.kz",
            full_name="Сидор Сидоров",
            hashed_password="hash",
            role=UserRole.employee,
            company=UserCompany.Polymedia,
            is_active=True
        )
    ]
    for u in users_to_create:
        db_session.add(u)
    await db_session.commit()

    await db_session.execute(
        text(
            "UPDATE users SET company = 'AJ-techCom' "
            "WHERE (LOWER(email) LIKE '%aj-tech%' OR LOWER(email) LIKE '%ajtech%') "
            "AND company = 'Polymedia';"
        )
    )
    await db_session.commit()
    
    # Сбрасываем кэш сессии, чтобы при следующем запросе данные загрузились из БД
    db_session.expire_all()

    # Проверяем, что компании обновились корректно
    res = await db_session.execute(select(User).where(User.email.in_(["ivan@aj-tech.kz", "petr@ajtech.com", "sidor@polymedia.kz"])))
    updated_users = res.scalars().all()
    
    user_map = {u.email: u.company for u in updated_users}
    
    assert user_map["ivan@aj-tech.kz"] == UserCompany.AJ_techCom
    assert user_map["petr@ajtech.com"] == UserCompany.AJ_techCom
    assert user_map["sidor@polymedia.kz"] == UserCompany.Polymedia

