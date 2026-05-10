"""Data access for Template Module.

This module is the only generated layer that should know about Databricks SQL.
Replace the demo rows with shared-db backed queries when the gold views are ready.
"""
from collections.abc import Awaitable, Callable
from uuid import uuid4

from template_backend.module_template.domain.entities import (
    TemplateMetric,
    TemplateSignal,
    TemplateSnapshot,
)
from template_backend.module_template.domain.value_objects import (
    TemplateMetricName,
    TemplateMetricValue,
    TemplateScope,
)
from shared_domain import AuditStamp, PlantId

SqlRunner = Callable[[str, str, list[dict] | None], Awaitable[list[dict]]]


class TemplateRepository:
    """Repository boundary for Template Module read models."""

    def __init__(self, token: str | None = None, run_sql: SqlRunner | None = None):
        """Create the repository.

        Args:
            token: Forwarded Databricks token. Demo mode works without one.
            run_sql: Async SQL runner, injected by production wiring/tests.
        """
        self._token = token
        self._run_sql = run_sql
        self._signals = _demo_signals()

    async def get_overview(self, plant_id: str | None = None) -> TemplateSnapshot:
        """Return a demo-ready overview snapshot.

        TODO: replace demo metrics with aggregation over the module_template
        gold view once the Databricks contract is available.
        """
        if self._token and self._run_sql:
            await self._run_sql(
                self._token,
                "SELECT 1 AS ready -- TODO: replace with module_template KPI query",
                [],
            )
        metrics = [
            TemplateMetric(TemplateMetricName("signals"), TemplateMetricValue(3, "count")),
            TemplateMetric(TemplateMetricName("coverage"), TemplateMetricValue(98.5, "percent")),
            TemplateMetric(TemplateMetricName("open_actions"), TemplateMetricValue(1, "count")),
        ]
        return TemplateSnapshot(
            identity=f"template:{plant_id or 'demo'}",
            plant_id=PlantId(plant_id or "demo"),
            metrics=metrics,
            audit=AuditStamp.created(system="template"),
        )

    async def list_signals(self, scope: TemplateScope) -> list[TemplateSignal]:
        """Return visible signals."""
        if scope.plant_id is None:
            return list(self._signals.values())
        return [signal for signal in self._signals.values() if signal.plant_id == scope.plant_id]

    async def get_signal(self, signal_id: str) -> TemplateSignal | None:
        """Return one signal by ID."""
        return self._signals.get(signal_id)

    async def create_signal(self, *, plant_id: str, title: str, status: str) -> TemplateSignal:
        """Create a demo signal.

        TODO: replace in-memory mutation with a command table or workflow API
        when this bounded context becomes write-enabled.
        """
        signal = TemplateSignal(
            str(uuid4()),
            plant_id=PlantId(plant_id),
            title=title,
            status=status,
            audit=AuditStamp.created(system="template"),
        )
        self._signals[signal.identity] = signal
        return signal

    async def update_status(self, signal_id: str, status: str) -> TemplateSignal | None:
        """Update a demo signal status."""
        signal = self._signals.get(signal_id)
        if signal is None:
            return None
        signal.change_status(status)
        return signal


def _demo_signals() -> dict[str, TemplateSignal]:
    """Return deterministic demo signals for first-wave concept apps."""
    signal = TemplateSignal(
        "demo-signal-1",
        plant_id=PlantId("demo"),
        title="Review generated Template Module signal",
        status="open",
        audit=AuditStamp.created(system="template"),
    )
    return {signal.identity: signal}
