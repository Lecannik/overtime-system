from datetime import datetime, timezone
from sqlalchemy import Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    
    # КТО совершил действие
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    # ЧТО за действие (например: "LOGIN", "SUBMIT_OVERTIME", "APPROVE_MANAGER")
    action: Mapped[str] = mapped_column(String, nullable=False)
    
    # Над ЧЕМ совершено действие (тип объекта: "overtime", "user", "project")
    target_type: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # ID этого объекта (например, ID заявки)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Любые доп. данные в формате JSON (старые/новые значения, IP-адрес и т.д.)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )