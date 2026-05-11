"""Entities for the module_template bounded context."""
from dataclasses import dataclass

from shared_domain import AggregateRoot, AuditStamp, PlantId

from template_backend.module_template.domain.events import (
    TemplateOverviewViewed,
    TemplateSignalStatusChanged,
)
from template_backend.module_template.domain.value_objects import (
    TemplateMetricName,
    TemplateMetricValue,
)


@dataclass(frozen=True)
class TemplateMetric:
    """A manufacturing metric surfaced by Template Module."""

    name: TemplateMetricName
    measurement: TemplateMetricValue


class TemplateSignal(AggregateRoot[str]):
    """Aggregate root for one actionable Template Module signal."""

    def __init__(
        self,
        identity: str,
        *,
        plant_id: PlantId,
        title: str,
        status: str,
        audit: AuditStamp,
    ) -> None:
        """Create a signal aggregate."""
        super().__init__(identity)
        if not title.strip():
            raise ValueError("Signal title cannot be blank")
        if not status.strip():
            raise ValueError("Signal status cannot be blank")
        self.plant_id = plant_id
        self.title = title
        self.status = status
        self.audit = audit

    def change_status(self, status: str) -> None:
        """Change workflow status and record a domain event."""
        if not status.strip():
            raise ValueError("Signal status cannot be blank")
        self.status = status
        self.register_event(TemplateSignalStatusChanged(signal_id=self.identity, status=status))


class TemplateSnapshot(AggregateRoot[str]):
    """Aggregate root for a Template Module analytics snapshot."""

    def __init__(
        self,
        identity: str,
        *,
        plant_id: PlantId,
        metrics: list[TemplateMetric],
        audit: AuditStamp,
    ) -> None:
        """Create an analytics snapshot."""
        super().__init__(identity)
        self.plant_id = plant_id
        self.metrics = tuple(metrics)
        self.audit = audit

    def mark_viewed(self) -> None:
        """Record that the snapshot was viewed by the application."""
        self.register_event(TemplateOverviewViewed(plant_id=str(self.plant_id)))
