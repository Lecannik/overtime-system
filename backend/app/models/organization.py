from sqlalchemy import Integer, String, ForeignKey
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
    # Менеджер проекта (первый уровень согласования)
    manager_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    # Лимит переработок в часах на неделю для этого проекта (превышение триггерит уведомления)
    weekly_limit: Mapped[int] = mapped_column(Integer, default=50)
