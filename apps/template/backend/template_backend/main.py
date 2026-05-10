"""FastAPI entrypoint for Template Module."""
from pathlib import Path

from template_backend.module_template.routers.router import router as template_router
from shared_api import create_rad_app


STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

rad_app = create_rad_app(
    title="Template Module API",
    static_dir=STATIC_DIR,
    app_name="template",
    demo_mode=True,
)

rad_app.include_router(template_router, prefix="/api/module-template", tags=["Template Module"])
rad_app.mount_spa()
app = rad_app.fastapi_app
