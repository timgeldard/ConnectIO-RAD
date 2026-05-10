const { Tree, formatFiles, generateFiles, joinPathFragments, names, updateJson } = require("@nx/devkit");

const SUPPORTED_LOCALES = [
  "da",
  "de",
  "en",
  "es",
  "fr",
  "ga",
  "id",
  "ja",
  "ms",
  "nl",
  "pl",
  "pt",
  "uk",
  "vi",
  "zh-Hans",
  "zh-Hant",
];

function toKebab(value) {
  return names(value).fileName;
}

function toSnake(value) {
  return toKebab(value).replaceAll("-", "_");
}

function toTitle(value) {
  return toKebab(value)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toNames(options) {
  const appName = toKebab(options.name);
  const projectName = appName.replaceAll("-", "");
  const contextName = options.context ? toSnake(options.context) : toSnake(appName);
  const displayName = options.displayName || toTitle(appName);
  const className = names(appName).className;
  const propertyName = names(appName).propertyName;
  const constantName = appName.replaceAll("-", "_").toUpperCase();
  const backendPackageName = `${projectName}_backend`;
  return {
    appName,
    projectName,
    contextName,
    contextKebab: contextName.replaceAll("_", "-"),
    displayName,
    className,
    propertyName,
    constantName,
    backendPackageName,
    backendDistName: `${projectName}-backend`,
    domain: options.domain || "quality",
    port: Number(options.port || 8010),
    demo: options.demo !== false,
  };
}

function planBoundedContextFiles(options) {
  const n = toNames(options);
  const root = `apps/${n.appName}`;
  const backend = `${root}/backend/${n.backendPackageName}`;
  const context = `${backend}/${n.contextName}`;
  return [
    `${root}/README.md`,
    `${root}/databricks.yml`,
    `${root}/deploy.toml`,
    `${root}/Makefile`,
    `${root}/.databricksignore`,
    `${root}/.ai-dev-kit/module-contract.md`,
    `${root}/.ai-dev-kit/prompts/implementation-notes.md`,
    `${root}/backend/project.json`,
    `${root}/backend/pyproject.toml`,
    `${backend}/__init__.py`,
    `${backend}/main.py`,
    `${context}/__init__.py`,
    `${context}/domain/__init__.py`,
    `${context}/domain/entities.py`,
    `${context}/domain/events.py`,
    `${context}/domain/models.py`,
    `${context}/domain/value_objects.py`,
    `${context}/application/__init__.py`,
    `${context}/application/queries.py`,
    `${context}/application/services.py`,
    `${context}/application/use_cases.py`,
    `${context}/dal/__init__.py`,
    `${context}/dal/repository.py`,
    `${context}/infrastructure/__init__.py`,
    `${context}/infrastructure/dependencies.py`,
    `${context}/infrastructure/settings.py`,
    `${context}/routers/__init__.py`,
    `${context}/routers/router.py`,
    `${context}/schemas.py`,
    `${context}/router.py`,
    `${root}/backend/tests/test_api.py`,
    `${root}/backend/tests/test_domain_properties.py`,
    `${root}/frontend/project.json`,
    `${root}/frontend/package.json`,
    `${root}/frontend/index.html`,
    `${root}/frontend/tsconfig.app.json`,
    `${root}/frontend/tsconfig.node.json`,
    `${root}/frontend/vite.config.ts`,
    `${root}/frontend/src/main.tsx`,
    `${root}/frontend/src/App.tsx`,
    `${root}/frontend/src/api.ts`,
    `${root}/frontend/src/queryClient.ts`,
    `${root}/frontend/src/index.css`,
    `${root}/frontend/src/${n.appName}/components/${n.className}MetricGrid.tsx`,
    `${root}/frontend/src/${n.appName}/hooks/use${n.className}Overview.ts`,
    `${root}/frontend/src/${n.appName}/pages/${n.className}Page.tsx`,
    `${root}/frontend/src/${n.appName}/types.ts`,
    `${root}/frontend/src/${n.appName}/chartConfig.ts`,
    `${root}/frontend/src/${n.appName}/__tests__/chartConfig.test.ts`,
    ...SUPPORTED_LOCALES.map((locale) => `${root}/frontend/src/i18n/locales/${locale}.json`),
    `${root}/e2e/project.json`,
    `${root}/e2e/playwright.config.ts`,
    `${root}/e2e/tests/smoke.spec.ts`,
  ];
}

function write(tree, path, content) {
  tree.write(path, content.endsWith("\n") ? content : `${content}\n`);
}

function createBackendFiles(tree, n) {
  const root = `apps/${n.appName}`;
  const pkgRoot = `${root}/backend/${n.backendPackageName}`;
  const contextRoot = `${pkgRoot}/${n.contextName}`;

  write(tree, `${root}/README.md`, `# ${n.displayName}

## Architecture

${n.displayName} is a ConnectIO-RAD bounded context generated from the Rapid New Module system.

- Backend: FastAPI in \`apps/${n.appName}/backend/${n.backendPackageName}\`
- Bounded context: \`${n.contextName}\` with \`domain/\`, \`application/\`, \`dal/\`, \`infrastructure/\`, and \`routers/\` boundaries
- Frontend: React + Vite + TanStack Query in \`apps/${n.appName}/frontend\`
- Deployment: Databricks Apps via \`databricks.yml\`

## Architecture Diagram

\`\`\`mermaid
flowchart LR
  UI[React page + hooks] --> API[FastAPI routers]
  API --> APP[Application services/use cases]
  APP --> DAL[DAL repository]
  APP --> DOMAIN[Domain entities/value objects/events]
  DAL --> DB[(Databricks SQL)]
\`\`\`

## Domain Glossary

| Term | Meaning |
|---|---|
| Signal | Actionable manufacturing condition surfaced to operators. |
| Metric | KPI value projected from Databricks SQL or demo data. |
| Plant scope | Optional plant filter carried through API, application, and DAL layers. |

## Development

\`\`\`bash
npx nx run ${n.projectName}-backend:serve
npx nx run ${n.projectName}-frontend:dev
npx nx run ${n.projectName}-backend:test
npx nx run ${n.projectName}-frontend:test
\`\`\`

## Domain TODOs

- Replace demo repository rows with Databricks SQL queries in \`${n.contextName}/dal/repository.py\`.
- Add domain-specific value objects and invariants in \`${n.contextName}/domain/value_objects.py\` and \`${n.contextName}/domain/entities.py\`.
- Update i18n strings in all 16 locale stubs before production release.
`);

  write(tree, `${root}/databricks.yml`, `bundle:
  name: ${n.projectName}

resources:
  apps:
    ${n.projectName}:
      name: ${n.appName}
      source_code_path: .
      description: ${n.displayName} manufacturing analytics module
      resources:
        - name: sql_warehouse
          sql_warehouse:
            id: \${var.sql_warehouse_id}

variables:
  sql_warehouse_id:
    description: Databricks SQL warehouse used by ${n.displayName}
`);

  write(tree, `${root}/deploy.toml`, `[app]
name = "${n.appName}"
display_name = "${n.displayName}"
backend_project = "${n.projectName}-backend"
frontend_project = "${n.projectName}-frontend"
`);

  write(tree, `${root}/Makefile`, `.PHONY: build deploy

build:
\tnpx nx run ${n.projectName}-frontend:build

deploy:
\tpython3 ../../scripts/deploy_app.py ${n.appName} --profile \${PROFILE:-uat}
`);

  write(tree, `${root}/.databricksignore`, `frontend/node_modules
frontend/coverage
backend/.pytest_cache
backend/.venv
`);

  write(tree, `${root}/.ai-dev-kit/module-contract.md`, `# ${n.displayName} AI Development Contract

This module follows the SPC/Trace2 bounded-context pattern.

- Keep domain models infrastructure-free.
- Keep application services transport-free.
- Keep routers thin and never import \`dal\` directly.
- Put Databricks SQL and external IO in \`${n.contextName}/dal\`.
- Use shared-api for FastAPI bootstrap, readiness, auth, error masking, and correlation IDs.
`);

  write(tree, `${root}/.ai-dev-kit/prompts/implementation-notes.md`, `# Implementation Notes

Use this app as a demo-ready shell first. Replace generated TODOs only when the real bounded context language and Databricks views are known.
`);

  write(tree, `${root}/backend/project.json`, JSON.stringify({
    name: `${n.projectName}-backend`,
    projectType: "application",
    tags: [`scope:${n.projectName}`, "type:backend"],
    implicitDependencies: ["shared-db", "shared-api", "shared-auth", "shared-domain"],
    targets: {
      sync: {
        executor: "nx:run-commands",
        options: { command: `uv sync --package ${n.backendDistName}`, cwd: "{workspaceRoot}" },
      },
      serve: {
        executor: "nx:run-commands",
        options: {
          command: `uv run --no-sync --package ${n.backendDistName} uvicorn ${n.backendPackageName}.main:app --reload --port ${n.port}`,
          cwd: "{workspaceRoot}",
        },
      },
      test: {
        executor: "nx:run-commands",
        options: { command: `uv run --no-sync --package ${n.backendDistName} python -m pytest`, cwd: `${root}/backend` },
        inputs: ["pyFiles", "^pyFiles", "sharedGlobals"],
        cache: true,
      },
      lint: {
        executor: "nx:run-commands",
        options: {
          command: `PYTHONPATH=apps/${n.appName}:libs/shared-api/src:libs/shared-auth/src:libs/shared-domain/src uv run --no-sync ruff check apps/${n.appName}/backend`,
          cwd: "{workspaceRoot}",
        },
        inputs: ["pyFiles", "^pyFiles", "sharedGlobals"],
        cache: true,
      },
      build: {
        executor: "nx:run-commands",
        options: { command: `uv run --no-sync --package ${n.backendDistName} python -m compileall ${n.backendPackageName}`, cwd: `${root}/backend` },
        inputs: ["pyFiles", "^pyFiles", "sharedGlobals"],
        cache: true,
      },
      "deploy-databricks": {
        executor: "nx:run-commands",
        options: { command: "make deploy PROFILE=uat", cwd: root },
        cache: false,
      },
    },
  }, null, 2));

  write(tree, `${root}/backend/pyproject.toml`, `[project]
name = "${n.backendDistName}"
version = "0.1.0"
description = "${n.displayName} backend"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115",
  "uvicorn>=0.30",
  "pydantic>=2",
  "hypothesis>=6.100",
  "shared-api",
  "shared-auth",
  "shared-domain",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
`);

  write(tree, `${pkgRoot}/__init__.py`, `"""${n.displayName} backend package."""`);

  write(tree, `${pkgRoot}/main.py`, `"""FastAPI entrypoint for ${n.displayName}."""
from pathlib import Path

from ${n.backendPackageName}.${n.contextName}.routers.router import router as ${n.propertyName}_router
from shared_api import create_rad_app


STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

rad_app = create_rad_app(
    title="${n.displayName} API",
    static_dir=STATIC_DIR,
    app_name="${n.projectName}",
    demo_mode=${n.demo ? "True" : "False"},
)

rad_app.include_router(${n.propertyName}_router, prefix="/api/${n.contextKebab}", tags=["${n.displayName}"])
rad_app.mount_spa()
app = rad_app.fastapi_app
`);

  for (const dir of ["domain", "application", "dal", "infrastructure", "routers"]) {
    write(tree, `${contextRoot}/${dir}/__init__.py`, `"""${dir} layer for the ${n.contextName} bounded context."""`);
  }
  write(tree, `${contextRoot}/__init__.py`, `"""${n.contextName} bounded context."""`);

  write(tree, `${contextRoot}/domain/value_objects.py`, `"""Value objects for the ${n.contextName} bounded context."""
from dataclasses import dataclass

from shared_domain import PlantId, ValueObject


@dataclass(frozen=True)
class ${n.className}MetricName(ValueObject):
    """Validated metric name used by ${n.displayName}."""

    value: str

    def __post_init__(self) -> None:
        """Validate the metric name."""
        if not self.value.strip():
            raise ValueError("Metric name cannot be blank")


@dataclass(frozen=True)
class ${n.className}MetricValue(ValueObject):
    """Validated numeric metric value and unit."""

    value: float
    unit: str

    def __post_init__(self) -> None:
        """Validate the metric value."""
        if not self.unit.strip():
            raise ValueError("Metric unit cannot be blank")


@dataclass(frozen=True)
class ${n.className}Scope(ValueObject):
    """Plant scope for ${n.displayName} read models."""

    plant_id: PlantId | None = None

    @classmethod
    def from_optional(cls, plant_id: str | None) -> "${n.className}Scope":
        """Create a scope from an optional plant filter."""
        return cls(plant_id=PlantId(plant_id) if plant_id else None)
`);

  write(tree, `${contextRoot}/domain/events.py`, `"""Domain events for the ${n.contextName} bounded context."""
from dataclasses import dataclass

from shared_domain import DomainEvent


@dataclass(frozen=True)
class ${n.className}OverviewViewed(DomainEvent):
    """Raised when the ${n.displayName} overview is viewed."""

    plant_id: str = "DEMO"


@dataclass(frozen=True)
class ${n.className}SignalStatusChanged(DomainEvent):
    """Raised when a signal changes workflow status."""

    signal_id: str
    status: str
`);

  write(tree, `${contextRoot}/domain/entities.py`, `"""Entities for the ${n.contextName} bounded context."""
from dataclasses import dataclass

from shared_domain import AggregateRoot, AuditStamp, PlantId

from ${n.backendPackageName}.${n.contextName}.domain.events import (
    ${n.className}OverviewViewed,
    ${n.className}SignalStatusChanged,
)
from ${n.backendPackageName}.${n.contextName}.domain.value_objects import (
    ${n.className}MetricName,
    ${n.className}MetricValue,
)


@dataclass(frozen=True)
class ${n.className}Metric:
    """A manufacturing metric surfaced by ${n.displayName}."""

    name: ${n.className}MetricName
    measurement: ${n.className}MetricValue


class ${n.className}Signal(AggregateRoot[str]):
    """Aggregate root for one actionable ${n.displayName} signal."""

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
        self.plant_id = plant_id
        self.title = title
        self.status = status
        self.audit = audit

    def change_status(self, status: str) -> None:
        """Change workflow status and record a domain event."""
        if not status.strip():
            raise ValueError("Signal status cannot be blank")
        self.status = status
        self.register_event(${n.className}SignalStatusChanged(signal_id=self.identity, status=status))


class ${n.className}Snapshot(AggregateRoot[str]):
    """Aggregate root for a ${n.displayName} analytics snapshot."""

    def __init__(
        self,
        identity: str,
        *,
        plant_id: PlantId,
        metrics: list[${n.className}Metric],
        audit: AuditStamp,
    ) -> None:
        """Create an analytics snapshot."""
        super().__init__(identity)
        self.plant_id = plant_id
        self.metrics = tuple(metrics)
        self.audit = audit

    def mark_viewed(self) -> None:
        """Record that the snapshot was viewed by the application."""
        self.register_event(${n.className}OverviewViewed(plant_id=str(self.plant_id)))
`);

  write(tree, `${contextRoot}/domain/models.py`, `"""Domain model for the ${n.contextName} bounded context."""
from ${n.backendPackageName}.${n.contextName}.domain.entities import (
    ${n.className}Metric,
    ${n.className}Signal,
    ${n.className}Snapshot,
)
from ${n.backendPackageName}.${n.contextName}.domain.events import (
    ${n.className}OverviewViewed,
    ${n.className}SignalStatusChanged,
)
from ${n.backendPackageName}.${n.contextName}.domain.value_objects import (
    ${n.className}MetricName,
    ${n.className}MetricValue,
    ${n.className}Scope,
)

__all__ = [
    "${n.className}Metric",
    "${n.className}MetricName",
    "${n.className}MetricValue",
    "${n.className}OverviewViewed",
    "${n.className}Scope",
    "${n.className}Signal",
    "${n.className}SignalStatusChanged",
    "${n.className}Snapshot",
]
`);

  write(tree, `${contextRoot}/application/use_cases.py`, `"""Application use cases for ${n.displayName}."""
from typing import Protocol

from ${n.backendPackageName}.${n.contextName}.domain.entities import ${n.className}Signal, ${n.className}Snapshot
from ${n.backendPackageName}.${n.contextName}.domain.value_objects import ${n.className}Scope
from ${n.backendPackageName}.${n.contextName}.schemas import (
    ${n.className}CreateRequest,
    ${n.className}Overview,
    ${n.className}SignalDTO,
    ${n.className}StatusUpdateRequest,
)


class ${n.className}RepositoryPort(Protocol):
    """Repository contract owned by the application layer."""

    async def get_overview(self, plant_id: str | None = None) -> ${n.className}Snapshot:
        """Return an overview snapshot."""

    async def list_signals(self, scope: ${n.className}Scope) -> list[${n.className}Signal]:
        """Return visible signals."""

    async def get_signal(self, signal_id: str) -> ${n.className}Signal | None:
        """Return one signal by ID."""

    async def create_signal(self, *, plant_id: str, title: str, status: str) -> ${n.className}Signal:
        """Create one signal."""

    async def update_status(self, signal_id: str, status: str) -> ${n.className}Signal | None:
        """Update signal workflow status."""


class Get${n.className}Overview:
    """Read model use case for the ${n.displayName} overview page."""

    def __init__(self, repository: ${n.className}RepositoryPort):
        self.repository = repository

    async def execute(self, plant_id: str | None = None) -> ${n.className}Overview:
        """Return overview metrics for the requested plant scope."""
        snapshot = await self.repository.get_overview(plant_id=plant_id)
        snapshot.mark_viewed()
        return ${n.className}Overview.from_snapshot(snapshot)


class List${n.className}Signals:
    """List actionable signals for the current plant scope."""

    def __init__(self, repository: ${n.className}RepositoryPort):
        self.repository = repository

    async def execute(self, plant_id: str | None = None) -> list[${n.className}SignalDTO]:
        """Return signal DTOs."""
        signals = await self.repository.list_signals(${n.className}Scope.from_optional(plant_id))
        return [${n.className}SignalDTO.from_entity(signal) for signal in signals]


class Get${n.className}Signal:
    """Fetch one actionable signal."""

    def __init__(self, repository: ${n.className}RepositoryPort):
        self.repository = repository

    async def execute(self, signal_id: str) -> ${n.className}SignalDTO | None:
        """Return one signal DTO, if found."""
        signal = await self.repository.get_signal(signal_id)
        return ${n.className}SignalDTO.from_entity(signal) if signal else None


class Create${n.className}Signal:
    """Create a new signal from a validated request."""

    def __init__(self, repository: ${n.className}RepositoryPort):
        self.repository = repository

    async def execute(self, request: ${n.className}CreateRequest) -> ${n.className}SignalDTO:
        """Create one signal."""
        signal = await self.repository.create_signal(
            plant_id=request.plant_id,
            title=request.title,
            status=request.status,
        )
        return ${n.className}SignalDTO.from_entity(signal)


class Update${n.className}SignalStatus:
    """Update one signal workflow status."""

    def __init__(self, repository: ${n.className}RepositoryPort):
        self.repository = repository

    async def execute(self, signal_id: str, request: ${n.className}StatusUpdateRequest) -> ${n.className}SignalDTO | None:
        """Update one signal status."""
        signal = await self.repository.update_status(signal_id, request.status)
        return ${n.className}SignalDTO.from_entity(signal) if signal else None
`);

  write(tree, `${contextRoot}/application/services.py`, `"""Application service wiring for ${n.displayName}."""
from dataclasses import dataclass

from ${n.backendPackageName}.${n.contextName}.application.use_cases import (
    Create${n.className}Signal,
    Get${n.className}Overview,
    Get${n.className}Signal,
    List${n.className}Signals,
    Update${n.className}SignalStatus,
)
from ${n.backendPackageName}.${n.contextName}.dal.repository import ${n.className}Repository
from ${n.backendPackageName}.${n.contextName}.schemas import (
    ${n.className}CreateRequest,
    ${n.className}Overview,
    ${n.className}SignalDTO,
    ${n.className}StatusUpdateRequest,
)


@dataclass(frozen=True)
class ${n.className}ApplicationService:
    """Facade used by routers to keep HTTP concerns out of use cases."""

    overview: Get${n.className}Overview
    list_signals: List${n.className}Signals
    get_signal: Get${n.className}Signal
    create_signal: Create${n.className}Signal
    update_status: Update${n.className}SignalStatus

    async def get_overview(self, plant_id: str | None = None) -> ${n.className}Overview:
        """Return the overview read model."""
        return await self.overview.execute(plant_id=plant_id)

    async def signals(self, plant_id: str | None = None) -> list[${n.className}SignalDTO]:
        """Return visible signals."""
        return await self.list_signals.execute(plant_id=plant_id)

    async def signal(self, signal_id: str) -> ${n.className}SignalDTO | None:
        """Return one signal by ID."""
        return await self.get_signal.execute(signal_id)

    async def create(self, request: ${n.className}CreateRequest) -> ${n.className}SignalDTO:
        """Create one signal."""
        return await self.create_signal.execute(request)

    async def set_status(self, signal_id: str, request: ${n.className}StatusUpdateRequest) -> ${n.className}SignalDTO | None:
        """Update one signal status."""
        return await self.update_status.execute(signal_id, request)


def create_${n.contextName}_service(token: str | None = None) -> ${n.className}ApplicationService:
    """Create a service instance with production repository wiring."""
    repository = ${n.className}Repository(token=token)
    return ${n.className}ApplicationService(
        overview=Get${n.className}Overview(repository),
        list_signals=List${n.className}Signals(repository),
        get_signal=Get${n.className}Signal(repository),
        create_signal=Create${n.className}Signal(repository),
        update_status=Update${n.className}SignalStatus(repository),
    )
`);

  write(tree, `${contextRoot}/application/queries.py`, `"""Compatibility query handlers for ${n.displayName}."""
from ${n.backendPackageName}.${n.contextName}.application.services import create_${n.contextName}_service
from ${n.backendPackageName}.${n.contextName}.schemas import ${n.className}Overview


async def get_${n.contextName}_overview(plant_id: str | None = None) -> ${n.className}Overview:
    """Return the overview read model."""
    return await create_${n.contextName}_service().get_overview(plant_id=plant_id)
`);

  write(tree, `${contextRoot}/dal/repository.py`, `"""Data access for ${n.displayName}.

This module is the only generated layer that should know about Databricks SQL.
Replace the demo rows with shared-db backed queries when the gold views are ready.
"""
from collections.abc import Awaitable, Callable
from uuid import uuid4

from ${n.backendPackageName}.${n.contextName}.domain.entities import (
    ${n.className}Metric,
    ${n.className}Signal,
    ${n.className}Snapshot,
)
from ${n.backendPackageName}.${n.contextName}.domain.value_objects import (
    ${n.className}MetricName,
    ${n.className}MetricValue,
    ${n.className}Scope,
)
from shared_domain import AuditStamp, PlantId

SqlRunner = Callable[[str, str, list[dict] | None], Awaitable[list[dict]]]


class ${n.className}Repository:
    """Repository boundary for ${n.displayName} read models."""

    def __init__(self, token: str | None = None, run_sql: SqlRunner | None = None):
        """Create the repository.

        Args:
            token: Forwarded Databricks token. Demo mode works without one.
            run_sql: Async SQL runner, injected by production wiring/tests.
        """
        self._token = token
        self._run_sql = run_sql
        self._signals = _demo_signals()

    async def get_overview(self, plant_id: str | None = None) -> ${n.className}Snapshot:
        """Return a demo-ready overview snapshot.

        TODO: replace demo metrics with aggregation over the ${n.contextName}
        gold view once the Databricks contract is available.
        """
        if self._token and self._run_sql:
            await self._run_sql(
                self._token,
                "SELECT 1 AS ready -- TODO: replace with ${n.contextName} KPI query",
                [],
            )
        metrics = [
            ${n.className}Metric(${n.className}MetricName("signals"), ${n.className}MetricValue(3, "count")),
            ${n.className}Metric(${n.className}MetricName("coverage"), ${n.className}MetricValue(98.5, "percent")),
            ${n.className}Metric(${n.className}MetricName("open_actions"), ${n.className}MetricValue(1, "count")),
        ]
        return ${n.className}Snapshot(
            identity=f"${n.projectName}:{plant_id or 'demo'}",
            plant_id=PlantId(plant_id or "demo"),
            metrics=metrics,
            audit=AuditStamp.created(system="${n.projectName}"),
        )

    async def list_signals(self, scope: ${n.className}Scope) -> list[${n.className}Signal]:
        """Return visible signals."""
        if scope.plant_id is None:
            return list(self._signals.values())
        return [signal for signal in self._signals.values() if signal.plant_id == scope.plant_id]

    async def get_signal(self, signal_id: str) -> ${n.className}Signal | None:
        """Return one signal by ID."""
        return self._signals.get(signal_id)

    async def create_signal(self, *, plant_id: str, title: str, status: str) -> ${n.className}Signal:
        """Create a demo signal.

        TODO: replace in-memory mutation with a command table or workflow API
        when this bounded context becomes write-enabled.
        """
        signal = ${n.className}Signal(
            str(uuid4()),
            plant_id=PlantId(plant_id),
            title=title,
            status=status,
            audit=AuditStamp.created(system="${n.projectName}"),
        )
        self._signals[signal.identity] = signal
        return signal

    async def update_status(self, signal_id: str, status: str) -> ${n.className}Signal | None:
        """Update a demo signal status."""
        signal = self._signals.get(signal_id)
        if signal is None:
            return None
        signal.change_status(status)
        return signal


def _demo_signals() -> dict[str, ${n.className}Signal]:
    """Return deterministic demo signals for first-wave concept apps."""
    signal = ${n.className}Signal(
        "demo-signal-1",
        plant_id=PlantId("demo"),
        title="Review generated ${n.displayName} signal",
        status="open",
        audit=AuditStamp.created(system="${n.projectName}"),
    )
    return {signal.identity: signal}
`);

  write(tree, `${contextRoot}/infrastructure/settings.py`, `"""Runtime settings for ${n.displayName}."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class ${n.className}Settings:
    """Environment-backed settings for this bounded context."""

    catalog: str = os.environ.get("DATABRICKS_CATALOG", "main")
    schema: str = os.environ.get("DATABRICKS_SCHEMA", "${n.projectName}")
    demo_mode: bool = os.environ.get("${n.constantName}_DEMO_MODE", "1") == "1"
`);

  write(tree, `${contextRoot}/infrastructure/dependencies.py`, `"""Dependency providers for ${n.displayName} routers."""
from fastapi import Depends

from shared_auth import UserIdentity, require_proxy_user

from ${n.backendPackageName}.${n.contextName}.application.services import (
    ${n.className}ApplicationService,
    create_${n.contextName}_service,
)


async def get_${n.contextName}_service(
    user: UserIdentity = Depends(require_proxy_user),
) -> ${n.className}ApplicationService:
    """Return an application service bound to the forwarded Databricks token."""
    return create_${n.contextName}_service(token=user.raw_token)
`);

  write(tree, `${contextRoot}/schemas.py`, `"""Transport schemas for ${n.displayName}."""
from pydantic import BaseModel, Field

from ${n.backendPackageName}.${n.contextName}.domain.entities import ${n.className}Signal, ${n.className}Snapshot


class MetricDTO(BaseModel):
    """Metric projected to the frontend."""

    name: str
    value: float
    unit: str


class ${n.className}SignalDTO(BaseModel):
    """Actionable signal projected to the frontend."""

    signal_id: str
    plant_id: str
    title: str
    status: str

    @classmethod
    def from_entity(cls, signal: ${n.className}Signal) -> "${n.className}SignalDTO":
        """Create a signal DTO from a domain entity."""
        return cls(
            signal_id=signal.identity,
            plant_id=str(signal.plant_id),
            title=signal.title,
            status=signal.status,
        )


class ${n.className}CreateRequest(BaseModel):
    """Request body for creating a ${n.displayName} signal."""

    plant_id: str = Field(default="DEMO", min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=160)
    status: str = Field(default="open", min_length=1, max_length=40)


class ${n.className}StatusUpdateRequest(BaseModel):
    """Request body for changing signal workflow status."""

    status: str = Field(min_length=1, max_length=40)


class ${n.className}Overview(BaseModel):
    """Overview response for ${n.displayName}."""

    data_available: bool = Field(default=True)
    reason: str | None = Field(default=None)
    plant_id: str
    metrics: list[MetricDTO]
    signals: list[${n.className}SignalDTO] = Field(default_factory=list)

    @classmethod
    def from_snapshot(cls, snapshot: ${n.className}Snapshot) -> "${n.className}Overview":
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
`);

  write(tree, `${contextRoot}/routers/router.py`, `"""FastAPI router for ${n.displayName}."""
from fastapi import APIRouter, Depends, HTTPException, status

from ${n.backendPackageName}.${n.contextName}.application.services import ${n.className}ApplicationService
from ${n.backendPackageName}.${n.contextName}.infrastructure.dependencies import get_${n.contextName}_service
from ${n.backendPackageName}.${n.contextName}.schemas import (
    ${n.className}CreateRequest,
    ${n.className}Overview,
    ${n.className}SignalDTO,
    ${n.className}StatusUpdateRequest,
)

router = APIRouter()


@router.get("/overview", response_model=${n.className}Overview)
async def overview(
    plant_id: str | None = None,
    service: ${n.className}ApplicationService = Depends(get_${n.contextName}_service),
) -> ${n.className}Overview:
    """Return the ${n.displayName} overview read model."""
    return await service.get_overview(plant_id=plant_id)


@router.get("/signals", response_model=list[${n.className}SignalDTO])
async def list_signals(
    plant_id: str | None = None,
    service: ${n.className}ApplicationService = Depends(get_${n.contextName}_service),
) -> list[${n.className}SignalDTO]:
    """Return actionable ${n.displayName} signals."""
    return await service.signals(plant_id=plant_id)


@router.get("/signals/{signal_id}", response_model=${n.className}SignalDTO)
async def get_signal(
    signal_id: str,
    service: ${n.className}ApplicationService = Depends(get_${n.contextName}_service),
) -> ${n.className}SignalDTO:
    """Return one actionable signal."""
    signal = await service.signal(signal_id)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return signal


@router.post("/signals", response_model=${n.className}SignalDTO, status_code=status.HTTP_201_CREATED)
async def create_signal(
    body: ${n.className}CreateRequest,
    service: ${n.className}ApplicationService = Depends(get_${n.contextName}_service),
) -> ${n.className}SignalDTO:
    """Create a demo signal.

    TODO: replace this command with the production workflow boundary once the
    bounded context owns write-enabled domain behavior.
    """
    return await service.create(body)


@router.patch("/signals/{signal_id}/status", response_model=${n.className}SignalDTO)
async def update_signal_status(
    signal_id: str,
    body: ${n.className}StatusUpdateRequest,
    service: ${n.className}ApplicationService = Depends(get_${n.contextName}_service),
) -> ${n.className}SignalDTO:
    """Update one signal workflow status."""
    signal = await service.set_status(signal_id, body)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return signal
`);

  write(tree, `${contextRoot}/router.py`, `"""Compatibility router for ${n.displayName}."""
from fastapi import APIRouter

from ${n.backendPackageName}.${n.contextName}.application.queries import get_${n.contextName}_overview
from ${n.backendPackageName}.${n.contextName}.schemas import ${n.className}Overview

router = APIRouter()


@router.get("/overview", response_model=${n.className}Overview)
async def overview(plant_id: str | None = None) -> ${n.className}Overview:
    """Return the ${n.displayName} overview read model."""
    return await get_${n.contextName}_overview(plant_id=plant_id)
`);

  write(tree, `${root}/backend/tests/test_api.py`, `"""API smoke tests for ${n.displayName}."""
from fastapi.testclient import TestClient

from ${n.backendPackageName}.${n.contextName}.application.services import create_${n.contextName}_service
from ${n.backendPackageName}.${n.contextName}.infrastructure.dependencies import get_${n.contextName}_service
from ${n.backendPackageName}.main import app


_service = create_${n.contextName}_service()
app.dependency_overrides[get_${n.contextName}_service] = lambda: _service


def test_overview_returns_demo_metrics() -> None:
    """The generated bounded context exposes a demo-ready overview endpoint."""
    response = TestClient(app).get("/api/${n.contextKebab}/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data_available"] is True
    assert payload["plant_id"] == "DEMO"
    assert len(payload["metrics"]) >= 1


def test_signal_crud_endpoints_are_demo_ready() -> None:
    """Generated CRUD-style signal routes work before live Databricks wiring."""
    client = TestClient(app)

    created = client.post(
        "/api/${n.contextKebab}/signals",
        json={"plant_id": "DEMO", "title": "Investigate supplier hold", "status": "open"},
    )
    assert created.status_code == 201
    signal_id = created.json()["signal_id"]

    listed = client.get("/api/${n.contextKebab}/signals")
    assert listed.status_code == 200
    assert any(signal["signal_id"] == signal_id for signal in listed.json())

    updated = client.patch(f"/api/${n.contextKebab}/signals/{signal_id}/status", json={"status": "closed"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "closed"
`);

  write(tree, `${root}/backend/tests/test_domain_properties.py`, `"""Property tests for ${n.displayName} domain primitives."""
from hypothesis import given
from hypothesis import strategies as st

from ${n.backendPackageName}.${n.contextName}.domain.value_objects import (
    ${n.className}MetricName,
    ${n.className}MetricValue,
)


@given(st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_metric_name_accepts_non_blank_values(value: str) -> None:
    """Metric names preserve valid domain language."""
    assert ${n.className}MetricName(value).value == value


@given(st.floats(allow_nan=False, allow_infinity=False), st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_metric_value_preserves_measurement(value: float, unit: str) -> None:
    """Metric values preserve numeric measurements and units."""
    metric = ${n.className}MetricValue(value=value, unit=unit)

    assert metric.value == value
    assert metric.unit == unit
`);
}

function createFrontendFiles(tree, n) {
  const root = `apps/${n.appName}`;
  write(tree, `${root}/frontend/project.json`, JSON.stringify({
    name: `${n.projectName}-frontend`,
    projectType: "application",
    tags: [`scope:${n.projectName}`, "type:frontend"],
    targets: {
      dev: { executor: "nx:run-commands", options: { command: "vite", cwd: `${root}/frontend` } },
      build: {
        executor: "nx:run-commands",
        options: { command: "npm run build", cwd: `${root}/frontend` },
        inputs: ["tsFiles", "^tsFiles", "sharedGlobals"],
        outputs: ["{projectRoot}/dist"],
        cache: true,
      },
      typecheck: { executor: "nx:run-commands", options: { command: "npm run typecheck", cwd: `${root}/frontend` } },
      lint: {
        executor: "nx:run-commands",
        options: { command: "npm run lint", cwd: `${root}/frontend` },
        inputs: ["tsFiles", "^tsFiles", "sharedGlobals"],
        cache: true,
      },
      test: {
        executor: "nx:run-commands",
        options: { command: "npm run test:ci", cwd: `${root}/frontend` },
        inputs: ["tsFiles", "^tsFiles", "sharedGlobals"],
        cache: true,
      },
      "test:coverage": {
        executor: "nx:run-commands",
        options: { command: "npm run test:coverage", cwd: `${root}/frontend` },
        inputs: ["tsFiles", "^tsFiles", "sharedGlobals"],
        outputs: ["{projectRoot}/coverage"],
        cache: true,
      },
    },
  }, null, 2));

  write(tree, `${root}/frontend/package.json`, JSON.stringify({
    name: `${n.projectName}-frontend`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      test: "vitest",
      "test:ci": "vitest run",
      "test:coverage": "vitest run --coverage",
      typecheck: "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
      lint: "npm run typecheck",
    },
    dependencies: {
      "@connectio/shared-app-context": "file:../../../libs/shared-app-context",
      "@connectio/shared-frontend-api": "file:../../../libs/shared-frontend-api",
      "@connectio/shared-frontend-i18n": "file:../../../libs/shared-frontend-i18n",
      "@connectio/shared-reporting": "file:../../../libs/shared-reporting",
      "@connectio/shared-ui": "file:../../../libs/shared-ui",
      "@tanstack/react-query": "^5.99.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@testing-library/jest-dom": "^6.9.1",
      "@testing-library/react": "^16.3.2",
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      "@vitejs/plugin-react": "^6.0.1",
      "@vitest/coverage-v8": "^4.1.5",
      jsdom: "^24.1.3",
      typescript: "^5.6.3",
      vite: "^8.0.11",
      vitest: "^4.1.5",
    },
  }, null, 2));

  write(tree, `${root}/frontend/index.html`, `<div id="root"></div><script type="module" src="/src/main.tsx"></script>`);
  write(tree, `${root}/frontend/tsconfig.app.json`, JSON.stringify({ compilerOptions: { jsx: "react-jsx", strict: true, module: "ESNext", target: "ES2022", moduleResolution: "Bundler", noEmit: true }, include: ["src"] }, null, 2));
  write(tree, `${root}/frontend/tsconfig.node.json`, JSON.stringify({ compilerOptions: { module: "ESNext", target: "ES2022", moduleResolution: "Bundler", noEmit: true }, include: ["vite.config.ts"] }, null, 2));
  write(tree, `${root}/frontend/vite.config.ts`, `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${n.port + 1000},
    proxy: {
      '/api': 'http://localhost:${n.port}',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { statements: 75, branches: 75, functions: 75, lines: 75 },
    },
  },
})
`);
  write(tree, `${root}/frontend/src/main.tsx`, `import React from 'react'
import ReactDOM from 'react-dom/client'
import { Root } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
`);
  write(tree, `${root}/frontend/src/App.tsx`, `import { QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { PlantProvider } from '@connectio/shared-app-context'
import { queryClient } from './queryClient'
import { ${n.className}Page } from './${n.appName}/pages/${n.className}Page'

/** Root application providers for ${n.displayName}. */
export function Root() {
  return (
    <I18nProvider appName="${n.projectName}">
      <PlantProvider appName="${n.projectName}">
        <QueryClientProvider client={queryClient}>
          <${n.className}Page />
        </QueryClientProvider>
      </PlantProvider>
    </I18nProvider>
  )
}
`);
  write(tree, `${root}/frontend/src/queryClient.ts`, `import { QueryClient } from '@tanstack/react-query'
import { queryClientDefaultOptions } from '@connectio/shared-frontend-api/query'

export const queryClient = new QueryClient({ defaultOptions: queryClientDefaultOptions })
`);
  write(tree, `${root}/frontend/src/api.ts`, `import { createApiClient } from '@connectio/shared-frontend-api'

export const api = createApiClient({ baseUrl: '/api/${n.contextKebab}' })
`);
  write(tree, `${root}/frontend/src/${n.appName}/types.ts`, `export interface Metric {
  name: string
  value: number
  unit: string
}

export interface ${n.className}Signal {
  signal_id: string
  plant_id: string
  title: string
  status: string
}

export interface ${n.className}Overview {
  data_available?: boolean
  reason?: string
  plant_id: string
  metrics: Metric[]
  signals: ${n.className}Signal[]
}
`);

  write(tree, `${root}/frontend/src/${n.appName}/hooks/use${n.className}Overview.ts`, `import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { ${n.className}Overview, ${n.className}Signal } from '../types'

export function use${n.className}Overview(plantId?: string) {
  return useQuery({
    queryKey: ['${n.projectName}', 'overview', plantId ?? 'demo'],
    queryFn: () => api.get<${n.className}Overview>('/overview', { query: { plant_id: plantId } }),
  })
}

export function use${n.className}Signals(plantId?: string) {
  return useQuery({
    queryKey: ['${n.projectName}', 'signals', plantId ?? 'demo'],
    queryFn: () => api.get<${n.className}Signal[]>('/signals', { query: { plant_id: plantId } }),
  })
}
`);
  write(tree, `${root}/frontend/src/${n.appName}/chartConfig.ts`, `export const ${n.propertyName}ChartConfig = {
  id: '${n.projectName}-signals',
  type: 'bar',
  title: '${n.displayName} Signals',
  dataSource: {
    id: '${n.projectName}-overview',
    kind: 'api',
    endpoint: '/api/${n.contextKebab}/overview',
    queryKey: ['${n.projectName}', 'signals'],
  },
  props: {
    xField: 'name',
    yField: 'value',
  },
  interactions: [],
  layout: {},
}
`);
  write(tree, `${root}/frontend/src/${n.appName}/__tests__/chartConfig.test.ts`, `import { describe, expect, it } from 'vitest'
import { ${n.propertyName}ChartConfig } from '../chartConfig'

describe('${n.propertyName}ChartConfig', () => {
  it('points to the generated overview endpoint', () => {
    expect(${n.propertyName}ChartConfig.dataSource.endpoint).toBe('/api/${n.contextKebab}/overview')
  })
})
`);
  write(tree, `${root}/frontend/src/${n.appName}/components/${n.className}MetricGrid.tsx`, `import type { Metric } from '../types'

interface ${n.className}MetricGridProps {
  metrics: Metric[]
}

/** Metric grid for ${n.displayName}. */
export function ${n.className}MetricGrid({ metrics }: ${n.className}MetricGridProps) {
  return (
    <section className="rad-metric-grid" aria-label="${n.displayName} metrics">
      {metrics.map((metric) => (
        <article className="rad-metric" key={metric.name}>
          <span>{metric.name.replaceAll('_', ' ')}</span>
          <strong>{metric.value}</strong>
          <small>{metric.unit}</small>
        </article>
      ))}
    </section>
  )
}
`);

  write(tree, `${root}/frontend/src/${n.appName}/pages/${n.className}Page.tsx`, `import { ${n.className}MetricGrid } from '../components/${n.className}MetricGrid'
import { use${n.className}Overview } from '../hooks/use${n.className}Overview'

/** Demo-ready first page for ${n.displayName}. */
export function ${n.className}Page() {
  const overview = use${n.className}Overview()

  if (overview.isLoading) {
    return <main className="rad-page"><p>Loading</p></main>
  }

  if (overview.isError || !overview.data?.data_available) {
    return (
      <main className="rad-page">
        <h1>${n.displayName}</h1>
        <p>Demo data is not available for this module yet.</p>
      </main>
    )
  }

  return (
    <main className="rad-page">
      <header className="rad-page__header">
        <div>
          <p className="rad-page__eyebrow">${n.domain}</p>
          <h1>${n.displayName}</h1>
        </div>
      </header>
      <${n.className}MetricGrid metrics={overview.data.metrics} />
    </main>
  )
}
`);
  write(tree, `${root}/frontend/src/index.css`, `@import '@connectio/shared-ui/styles/kerry-app.css';

.rad-page {
  min-height: 100vh;
  padding: 32px;
  background: var(--kerry-bg, #f6f8fa);
  color: var(--kerry-text, #182026);
}

.rad-page__header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.rad-page__eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0;
}

.rad-page h1 {
  margin: 0;
  font-size: 2rem;
}

.rad-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.rad-metric {
  border: 1px solid #d9e2e8;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.rad-metric span,
.rad-metric small {
  display: block;
  color: #4a5c66;
}

.rad-metric strong {
  display: block;
  margin: 8px 0;
  font-size: 2rem;
}
`);

  for (const locale of SUPPORTED_LOCALES) {
    write(tree, `${root}/frontend/src/i18n/locales/${locale}.json`, JSON.stringify({
      title: n.displayName,
      loading: "Loading",
      empty: "Demo data is not available for this module yet.",
      overview: "Overview",
      signals: "Signals",
    }, null, 2));
  }
}

function createE2eFiles(tree, n) {
  const root = `apps/${n.appName}`;
  write(tree, `${root}/e2e/project.json`, JSON.stringify({
    name: `${n.projectName}-e2e`,
    projectType: "application",
    tags: [`scope:${n.projectName}`, "type:e2e"],
    implicitDependencies: [`${n.projectName}-frontend`],
    targets: {
      e2e: {
        executor: "nx:run-commands",
        options: { command: "npx playwright test", cwd: `${root}/e2e` },
        cache: false,
      },
    },
  }, null, 2));
  write(tree, `${root}/e2e/playwright.config.ts`, `import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:${n.port + 1000}',
  },
})
`);
  write(tree, `${root}/e2e/tests/smoke.spec.ts`, `import { expect, test } from '@playwright/test'

test('${n.displayName} loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '${n.displayName}' })).toBeVisible()
})
`);
}

function updatePythonWorkspace(tree, n) {
  if (!tree.exists("pyproject.toml")) return;
  let text = tree.read("pyproject.toml", "utf-8");
  const member = `  "apps/${n.appName}/backend",`;
  if (!text.includes(member)) {
    text = text.replace("  \"apps/platform/backend\",\n", `  "apps/platform/backend",\n${member}\n`);
  }
  const source = `${n.backendDistName} = { workspace = true }`;
  if (!text.includes(source)) {
    text = text.replace("trace2-backend = { workspace = true }\n", `trace2-backend = { workspace = true }\n${source}\n`);
  }
  tree.write("pyproject.toml", text);
}

function updatePackageWorkspace(tree) {
  updateJson(tree, "package.json", (json) => {
    json.workspaces = Array.from(new Set([...(json.workspaces || []), "tools/generators"])).sort();
    json.devDependencies = json.devDependencies || {};
    json.devDependencies["@nx/devkit"] = json.devDependencies["@nx/devkit"] || "^22.0.0";
    json.scripts = json.scripts || {};
    json.scripts["test:generators"] = "node --test tests/tools/generators/*.test.js";
    return json;
  });
}

function updateNxConstraints(tree, n) {
  updateJson(tree, "nx.json", (json) => {
    const constraints = json.pluginsConfig?.["@nx/eslint"]?.depConstraints;
    if (Array.isArray(constraints) && !constraints.some((constraint) => constraint.sourceTag === `scope:${n.projectName}`)) {
      constraints.push({
        sourceTag: `scope:${n.projectName}`,
        onlyDependOnLibsWithTags: [`scope:${n.projectName}`, "scope:shared"],
      });
    }
    return json;
  });
}

function updateDddGuardrail(tree, n) {
  const path = "scripts/tests/test_ddd_architecture_guardrails.py";
  if (!tree.exists(path)) return;
  let text = tree.read(path, "utf-8");
  const match = text.match(/DDD_APP_NAMES = \(([\s\S]*?)\)\nAPP_BACKENDS/);
  if (match && !match[1].includes(`"${n.projectName}"`)) {
    const appNames = match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/^"|"$/g, ""));
    appNames.push(n.projectName);
    appNames.sort();
    const replacement = `DDD_APP_NAMES = (\n${appNames.map((appName) => `    "${appName}",`).join("\n")}\n)\nAPP_BACKENDS`;
    text = text.replace(/DDD_APP_NAMES = \(([\s\S]*?)\)\nAPP_BACKENDS/, replacement);
  }
  if (!text.includes(`"${n.projectName}": {"${n.contextName}"}`)) {
    text = text.replace("    \"warehouse360\": {", `    "${n.projectName}": {"${n.contextName}"},\n    "warehouse360": {`);
  }
  tree.write(path, text);
}

function updatePlatformManifest(tree, n, skipPlatform) {
  if (skipPlatform) return;
  const path = "apps/platform/frontend/src/shell/module-manifest.json";
  const manifest = tree.exists(path)
    ? JSON.parse(tree.read(path, "utf-8"))
    : { modules: [] };
  manifest.modules = manifest.modules || [];
  if (!manifest.modules.some((module) => module.moduleId === n.projectName)) {
    manifest.modules.push({
      moduleId: n.projectName,
      displayName: n.displayName,
      shortName: n.projectName.slice(0, 8).toUpperCase(),
      tagline: `${n.displayName} demo module`,
      domain: n.domain,
      iconSet: "shared-ui",
      icon: "chart",
      color: "#289BA2",
      sidebarGroup: n.domain === "warehouse" ? "warehouse" : n.domain === "operations" ? "operations" : "quality",
      sidebarOrder: 90,
      defaultTab: "overview",
      tabs: [{ id: "overview", label: "Overview", num: "01" }],
      landingCard: {
        tag: `${n.displayName} · demo-ready`,
        desc: "Generated bounded context shell. Ready for demo data first, then Databricks SQL wiring.",
        stats: [
          { value: "3", label: "Demo signals" },
          { value: "98.5%", label: "Coverage", tone: "good" },
          { value: "1", label: "Open actions", tone: "warn" },
        ],
      },
      contextBarSlot: false,
      routeBase: `/${n.appName}/`,
      i18nNamespace: n.projectName,
      isUserSelectable: true,
      isPinnedByDefault: false,
      isMandatory: false,
      backendPrefix: `/api/${n.contextKebab}`,
    });
  }
  manifest.modules.sort((a, b) => String(a.moduleId).localeCompare(String(b.moduleId)));
  tree.write(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function boundedContextGenerator(tree, options) {
  const n = toNames(options);
  createBackendFiles(tree, n);
  createFrontendFiles(tree, n);
  createE2eFiles(tree, n);
  updatePythonWorkspace(tree, n);
  updatePackageWorkspace(tree);
  updateNxConstraints(tree, n);
  updateDddGuardrail(tree, n);
  updatePlatformManifest(tree, n, Boolean(options.skipPlatform));
  await formatFiles(tree);
}

module.exports = boundedContextGenerator;
module.exports.default = boundedContextGenerator;
module.exports.toNames = toNames;
module.exports.planBoundedContextFiles = planBoundedContextFiles;
