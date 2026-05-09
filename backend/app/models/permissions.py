from sqlalchemy import Integer, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class StagePermission(Base):
    """
    Динамическая матрица прав доступа к стадиям CRM/Проектов.
    Позволяет связывать Должность или конкретного Пользователя с разрешенными стадиями.
    """
    __tablename__ = "stage_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    
    # Кому даем право (либо должности, либо конкретному человеку)
    position_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("job_positions.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    # На какую стадию даем право
    stage_id: Mapped[int] = mapped_column(Integer, ForeignKey("crm_stages.id", ondelete="CASCADE"))
    
    # Что именно разрешаем
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)

    # Связи
    stage: Mapped["CRMStage"] = relationship("CRMStage")
    position: Mapped["JobPosition"] = relationship("JobPosition")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        UniqueConstraint('position_id', 'stage_id', name='uix_position_stage'),
        UniqueConstraint('user_id', 'stage_id', name='uix_user_stage'),
    )
