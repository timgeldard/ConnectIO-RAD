"""Application service wiring for Template Module."""
from dataclasses import dataclass

from template_backend.module_template.application.use_cases import (
    CreateTemplateSignal,
    GetTemplateOverview,
    GetTemplateSignal,
    ListTemplateSignals,
    UpdateTemplateSignalStatus,
)
from template_backend.module_template.dal.repository import TemplateRepository
from template_backend.module_template.schemas import (
    TemplateCreateRequest,
    TemplateOverview,
    TemplateSignalDTO,
    TemplateStatusUpdateRequest,
)


@dataclass(frozen=True)
class TemplateApplicationService:
    """Facade used by routers to keep HTTP concerns out of use cases."""

    overview: GetTemplateOverview
    list_signals: ListTemplateSignals
    get_signal: GetTemplateSignal
    create_signal: CreateTemplateSignal
    update_status: UpdateTemplateSignalStatus

    async def get_overview(self, plant_id: str | None = None) -> TemplateOverview:
        """Return the overview read model."""
        return await self.overview.execute(plant_id=plant_id)

    async def signals(self, plant_id: str | None = None) -> list[TemplateSignalDTO]:
        """Return visible signals."""
        return await self.list_signals.execute(plant_id=plant_id)

    async def signal(self, signal_id: str) -> TemplateSignalDTO | None:
        """Return one signal by ID."""
        return await self.get_signal.execute(signal_id)

    async def create(self, request: TemplateCreateRequest) -> TemplateSignalDTO:
        """Create one signal."""
        return await self.create_signal.execute(request)

    async def set_status(self, signal_id: str, request: TemplateStatusUpdateRequest) -> TemplateSignalDTO | None:
        """Update one signal status."""
        return await self.update_status.execute(signal_id, request)


def create_module_template_service(token: str | None = None) -> TemplateApplicationService:
    """Create a service instance with production repository wiring."""
    repository = TemplateRepository(token=token)
    return TemplateApplicationService(
        overview=GetTemplateOverview(repository),
        list_signals=ListTemplateSignals(repository),
        get_signal=GetTemplateSignal(repository),
        create_signal=CreateTemplateSignal(repository),
        update_status=UpdateTemplateSignalStatus(repository),
    )
