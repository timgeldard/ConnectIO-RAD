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
from template_backend.module_template.domain.entities import TemplateSignal, TemplateSnapshot


@dataclass(frozen=True)
class TemplateApplicationService:
    """Facade used by routers to keep HTTP concerns out of use cases.

    This service coordinates the execution of application use cases and
    provides a high-level API for the transport layer (FastAPI routers).
    It ensures that domain entities and snapshots are returned to the edge,
    leaving the DTO mapping to the caller.
    """

    overview: GetTemplateOverview
    list_signals: ListTemplateSignals
    get_signal: GetTemplateSignal
    create_signal: CreateTemplateSignal
    update_status: UpdateTemplateSignalStatus

    async def get_overview(self, token: str | None, plant_id: str | None = None) -> TemplateSnapshot:
        """Return the overview read model snapshot.

        Args:
            token: Forwarded Databricks access token.
            plant_id: Optional SAP plant identifier to filter metrics.

        Returns:
            A TemplateSnapshot aggregate containing manufacturing metrics.
        """
        return await self.overview.execute(token, plant_id=plant_id)

    async def signals(self, token: str | None, plant_id: str | None = None) -> list[TemplateSignal]:
        """Return visible actionable signals.

        Args:
            token: Forwarded Databricks access token.
            plant_id: Optional SAP plant identifier to filter signals.

        Returns:
            List of TemplateSignal entities visible in the requested scope.
        """
        return await self.list_signals.execute(token, plant_id=plant_id)

    async def signal(self, token: str | None, signal_id: str) -> TemplateSignal | None:
        """Return one actionable signal by ID.

        Args:
            token: Forwarded Databricks access token.
            signal_id: Unique identifier for the requested signal.

        Returns:
            The TemplateSignal entity if found, otherwise None.
        """
        return await self.get_signal.execute(token, signal_id)

    async def create(self, token: str | None, *, plant_id: str, title: str, status: str) -> TemplateSignal:
        """Create a new signal aggregate.

        Args:
            token: Forwarded Databricks access token.
            plant_id: SAP plant identifier where the signal originated.
            title: Human-readable description of the signal.
            status: Initial workflow status (e.g., 'open').

        Returns:
            The newly created TemplateSignal entity.
        """
        return await self.create_signal.execute(
            token,
            plant_id=plant_id,
            title=title,
            status=status,
        )

    async def set_status(self, token: str | None, signal_id: str, status: str) -> TemplateSignal | None:
        """Update one signal workflow status.

        Args:
            token: Forwarded Databricks access token.
            signal_id: Unique identifier for the signal to update.
            status: The new workflow status string.

        Returns:
            The updated TemplateSignal entity if found, otherwise None.
        """
        return await self.update_status.execute(token, signal_id, status)


# Singleton repository to maintain in-memory demo state across requests
_REPOSITORY = TemplateRepository()


def create_module_template_service() -> TemplateApplicationService:
    """Create a service instance with shared demo repository wiring.

    Returns:
        A fully wired TemplateApplicationService instance.
    """
    return TemplateApplicationService(
        overview=GetTemplateOverview(_REPOSITORY),
        list_signals=ListTemplateSignals(_REPOSITORY),
        get_signal=GetTemplateSignal(_REPOSITORY),
        create_signal=CreateTemplateSignal(_REPOSITORY),
        update_status=UpdateTemplateSignalStatus(_REPOSITORY),
    )
