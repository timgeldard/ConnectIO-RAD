"""Compatibility router for Template Module."""
from fastapi import APIRouter

from template_backend.module_template.application.queries import get_module_template_overview
from template_backend.module_template.schemas import TemplateOverview

router = APIRouter()


@router.get("/overview", response_model=TemplateOverview)
async def overview(plant_id: str | None = None) -> TemplateOverview:
    """Return the Template Module overview read model."""
    return await get_module_template_overview(plant_id=plant_id)
