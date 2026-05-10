"""Domain events for the module_template bounded context."""
from dataclasses import dataclass

from shared_domain import DomainEvent


@dataclass(frozen=True)
class TemplateOverviewViewed(DomainEvent):
    """Raised when the Template Module overview is viewed."""

    plant_id: str = "DEMO"


@dataclass(frozen=True)
class TemplateSignalStatusChanged(DomainEvent):
    """Raised when a signal changes workflow status."""

    signal_id: str
    status: str
