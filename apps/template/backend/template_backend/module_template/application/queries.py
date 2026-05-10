"""Compatibility query handlers for Template Module."""
from template_backend.module_template.application.services import create_module_template_service
from template_backend.module_template.schemas import TemplateOverview


async def get_module_template_overview(plant_id: str | None = None) -> TemplateOverview:
    """Return the overview read model."""
    return await create_module_template_service().get_overview(plant_id=plant_id)
