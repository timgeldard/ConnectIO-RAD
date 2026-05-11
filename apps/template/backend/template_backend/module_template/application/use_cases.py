"""Application use cases for Template Module."""
from typing import Protocol

from template_backend.module_template.domain.entities import TemplateSignal, TemplateSnapshot
from template_backend.module_template.domain.value_objects import TemplateScope


class TemplateRepositoryPort(Protocol):
    """Repository contract owned by the application layer."""

    async def get_overview(self, token: str | None, plant_id: str | None = None) -> TemplateSnapshot:
        """Return an overview snapshot."""

    async def list_signals(self, token: str | None, scope: TemplateScope) -> list[TemplateSignal]:
        """Return visible signals."""

    async def get_signal(self, token: str | None, signal_id: str) -> TemplateSignal | None:
        """Return one signal by ID."""

    async def create_signal(self, token: str | None, *, plant_id: str, title: str, status: str) -> TemplateSignal:
        """Create one signal."""

    async def update_status(self, token: str | None, signal_id: str, status: str) -> TemplateSignal | None:
        """Update signal workflow status."""


class GetTemplateOverview:
    """Read model use case for the Template Module overview page."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, token: str | None, plant_id: str | None = None) -> TemplateSnapshot:
        """Return overview metrics for the requested plant scope."""
        snapshot = await self.repository.get_overview(token, plant_id=plant_id)
        snapshot.mark_viewed()
        return snapshot


class ListTemplateSignals:
    """List actionable signals for the current plant scope."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, token: str | None, plant_id: str | None = None) -> list[TemplateSignal]:
        """Return signals."""
        return await self.repository.list_signals(token, TemplateScope.from_optional(plant_id))


class GetTemplateSignal:
    """Fetch one actionable signal."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, token: str | None, signal_id: str) -> TemplateSignal | None:
        """Return one signal, if found."""
        return await self.repository.get_signal(token, signal_id)


class CreateTemplateSignal:
    """Create a new signal from a validated request."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, token: str | None, *, plant_id: str, title: str, status: str) -> TemplateSignal:
        """Create one signal."""
        return await self.repository.create_signal(
            token,
            plant_id=plant_id,
            title=title,
            status=status,
        )


class UpdateTemplateSignalStatus:
    """Update one signal workflow status."""

    def __init__(self, repository: TemplateRepositoryPort):
        self.repository = repository

    async def execute(self, token: str | None, signal_id: str, status: str) -> TemplateSignal | None:
        """Update one signal status."""
        return await self.repository.update_status(token, signal_id, status)
