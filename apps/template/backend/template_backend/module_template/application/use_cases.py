"""Application use cases for Template Module."""
from typing import Protocol

from template_backend.module_template.domain.entities import TemplateSignal, TemplateSnapshot
from template_backend.module_template.domain.value_objects import TemplateScope
from template_backend.module_template.schemas import (
    TemplateCreateRequest,
    TemplateOverview,
    TemplateSignalDTO,
    TemplateStatusUpdateRequest,
)


class TemplateRepositoryPort(Protocol):
    """Repository contract owned by the application layer."""

    async def get_overview(self, plant_id: str | None = None) -> TemplateSnapshot:
        """Return an overview snapshot."""

    async def list_signals(self, scope: TemplateScope) -> list[TemplateSignal]:
        """Return visible signals."""

    async def get_signal(self, signal_id: str) -> TemplateSignal | None:
        """Return one signal by ID."""

    async def create_signal(self, *, plant_id: str, title: str, status: str) -> TemplateSignal:
        """Create one signal."""

    async def update_status(self, signal_id: str, status: str) -> TemplateSignal | None:
        """Update signal workflow status."""


class GetTemplateOverview:
    """Read model use case for the Template Module overview page."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, plant_id: str | None = None) -> TemplateOverview:
        """Return overview metrics for the requested plant scope."""
        snapshot = await self.repository.get_overview(plant_id=plant_id)
        snapshot.mark_viewed()
        return TemplateOverview.from_snapshot(snapshot)


class ListTemplateSignals:
    """List actionable signals for the current plant scope."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, plant_id: str | None = None) -> list[TemplateSignalDTO]:
        """Return signal DTOs."""
        signals = await self.repository.list_signals(TemplateScope.from_optional(plant_id))
        return [TemplateSignalDTO.from_entity(signal) for signal in signals]


class GetTemplateSignal:
    """Fetch one actionable signal."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, signal_id: str) -> TemplateSignalDTO | None:
        """Return one signal DTO, if found."""
        signal = await self.repository.get_signal(signal_id)
        return TemplateSignalDTO.from_entity(signal) if signal else None


class CreateTemplateSignal:
    """Create a new signal from a validated request."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, request: TemplateCreateRequest) -> TemplateSignalDTO:
        """Create one signal."""
        signal = await self.repository.create_signal(
            plant_id=request.plant_id,
            title=request.title,
            status=request.status,
        )
        return TemplateSignalDTO.from_entity(signal)


class UpdateTemplateSignalStatus:
    """Update one signal workflow status."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, signal_id: str, request: TemplateStatusUpdateRequest) -> TemplateSignalDTO | None:
        """Update one signal status."""
        signal = await self.repository.update_status(signal_id, request.status)
        return TemplateSignalDTO.from_entity(signal) if signal else None
