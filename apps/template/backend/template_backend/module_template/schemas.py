"""Transport schemas for Template Module."""
from pydantic import BaseModel, Field

from template_backend.module_template.domain.entities import TemplateSignal, TemplateSnapshot


class MetricDTO(BaseModel):
    """Metric projected to the frontend."""

    name: str
    value: float
    unit: str


class TemplateSignalDTO(BaseModel):
    """Actionable signal projected to the frontend."""

    signal_id: str
    plant_id: str
    title: str
    status: str

    @classmethod
    def from_entity(cls, signal: TemplateSignal) -> "TemplateSignalDTO":
        """Create a signal DTO from a domain entity."""
        return cls(
            signal_id=signal.identity,
            plant_id=str(signal.plant_id),
            title=signal.title,
            status=signal.status,
        )


class TemplateCreateRequest(BaseModel):
    """Request body for creating a Template Module signal."""

    plant_id: str = Field(default="DEMO", min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=160)
    status: str = Field(default="open", min_length=1, max_length=40)


class TemplateStatusUpdateRequest(BaseModel):
    """Request body for changing signal workflow status."""

    status: str = Field(min_length=1, max_length=40)


class TemplateOverview(BaseModel):
    """Overview response for Template Module."""

    data_available: bool = Field(default=True)
    reason: str | None = Field(default=None)
    plant_id: str
    metrics: list[MetricDTO]
    signals: list[TemplateSignalDTO] = Field(default_factory=list)

    @classmethod
    def from_snapshot(cls, snapshot: TemplateSnapshot) -> "TemplateOverview":
        """Create a response DTO from a domain snapshot."""
        return cls(
            plant_id=str(snapshot.plant_id),
            metrics=[
                MetricDTO(
                    name=metric.name.value,
                    value=metric.measurement.value,
                    unit=metric.measurement.unit,
                )
                for metric in snapshot.metrics
            ],
        )
