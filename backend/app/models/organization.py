from sqlalchemy import Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Department(Base):
    """
    Модель отдела организации.
    Используется для группировки сотрудников и определения их прямого руководителя (Head of Department).
    """
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Ссылка на пользователя - начальника отдела (для согласования заявок)
    head_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))


class Project(Base):
    """
    Модель рабочего проекта.
    Переработки привязываются к конкретному проекту для учета лимитов и контроля бюджетов.
    """
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Номер проекта в формате 2026-00001
    code: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)
    # Менеджер проекта (первый уровень согласования)
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    # Лимит переработок в часах на неделю для этого проекта (превышение триггерит уведомления)
    weekly_limit: Mapped[int] = mapped_column(Integer, default=50)
    # Флаг активности проекта (активен/архивирован)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
