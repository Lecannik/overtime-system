from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Ссылка на пользователя - начальника отдела
    head_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Менеджер проекта
    manager_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    # Лимит переработок в часах на неделю для этого проекта
    weekly_limit: Mapped[int] = mapped_column(Integer, default=50)
