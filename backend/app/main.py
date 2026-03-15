from fastapi import FastAPI
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.overtime import router as overtime_router
from app.api.v1.admin import router as admin_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.projects import router as projects_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.audit import router as audit_router

app = FastAPI(title="Overtime System")

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(overtime_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit"])
