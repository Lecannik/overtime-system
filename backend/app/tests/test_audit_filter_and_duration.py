"""
Тесты для проверки корректности фильтрации журнала аудита,
человекочитаемого форматирования времени и фиксации данных сотрудника.
"""
import pytest
from app.core.utils import format_duration_human
from app.repositories.audit import CATEGORY_ACTION_MAP
from app.services.audit_export_service import ACTION_TITLES, ACTION_CATEGORIES, format_details_to_text


def test_format_duration_human():
    """Проверка форматирования длительности с секундами и минутами."""
    # Меньше минуты
    assert format_duration_human(0) == "0 сек."
    assert format_duration_human(45) == "45 сек."
    assert format_duration_human(59) == "59 сек."

    # От 1 до 59 минут
    assert format_duration_human(60) == "1м"
    assert format_duration_human(75) == "1м 15с"
    assert format_duration_human(125) == "2м 5с"
    assert format_duration_human(3599) == "59м 59с"

    # Часы и минуты
    assert format_duration_human(3600) == "1ч"
    assert format_duration_human(3665) == "1ч 1м"
    assert format_duration_human(46380) == "12ч 53м"


def test_category_action_map_coverage():
    """Проверка наличия всех ключевых действий в маппинге категорий."""
    # Согласование
    assert "REVIEW_ADMIN" in CATEGORY_ACTION_MAP["reviews"]
    assert "REVIEW_HEAD" in CATEGORY_ACTION_MAP["reviews"]
    assert "REVIEW_MANAGER" in CATEGORY_ACTION_MAP["reviews"]
    assert "SELF_REVIEW_ADMIN" in CATEGORY_ACTION_MAP["reviews"]

    # Заявки
    assert "ADMIN_UPDATE_OVERTIME" in CATEGORY_ACTION_MAP["overtimes"]
    assert "DELETE_OVERTIME" in CATEGORY_ACTION_MAP["overtimes"]
    assert "UPDATE_OVERTIME_TIME" in CATEGORY_ACTION_MAP["overtimes"]

    # Синхронизация и безопасность
    assert "IMPORT_PROJECT_ODOO" in CATEGORY_ACTION_MAP["projects"]
    assert "IMPORT_USER_MS" in CATEGORY_ACTION_MAP["users"]
    assert "LOGIN_2FA" in CATEGORY_ACTION_MAP["auth"]
    assert "LOGIN_SSO" in CATEGORY_ACTION_MAP["auth"]


def test_audit_export_target_employee():
    """Проверка вывода данных целевого сотрудника при экспорте аудита."""
    details = {
        "status": "APPROVED",
        "hours": 3.0,
        "employee_name": "Иван Иванов",
        "employee_email": "admin@example.com"
    }
    text = format_details_to_text("ADMIN_UPDATE_OVERTIME", details)
    assert "Сотрудник: Иван Иванов (admin@example.com)" in text
