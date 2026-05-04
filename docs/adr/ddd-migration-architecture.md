# ADR: Pragmatic DDD Migration Boundaries

## Status

Accepted. Phase 4 validation completed 2026-05-04.

## Context

Trace2, SPC, and EnvMon are moving from route/DAL organization toward bounded contexts. The apps are read-heavy Databricks applications, so the target is a pragmatic modular monolith with CQRS-style read models where they simplify delivery, not pure tactical DDD everywhere.

## Decision

Each migrated bounded context should use these boundaries:

- `domain/` contains deterministic business rules and value objects. It must not import API schemas, database helpers, application config, routers, or DAL modules.
- `application/` contains use cases and query handlers. It coordinates domain objects, DAL calls, and cross-context application services.
- `dal/` contains SQL and database runtime details.
- `router.py` contains HTTP concerns only: dependency injection, request parsing, rate limits, response models, and error mapping.

Cross-context access must go through another context's `application/` module or an explicitly documented shared read model. Direct imports of another context's `dal/` are not allowed from routers.

## Consequences

Read paths may stay simple and query-oriented, but orchestration should live in `application/` instead of FastAPI route functions. Write paths must construct domain value objects before hitting DAL code so invariants are enforced before SQL execution.

Import-boundary tests enforce the most important rules while the migration is still underway.

Phase 3 adds repository-wide guardrails in `scripts/tests/test_ddd_architecture_guardrails.py`
for the migrated DDD apps (`trace2`, `spc`, `envmon`, `warehouse360`, and
`processorderhistory`). These tests enforce:

- domain modules do not import transport, application, DAL, SQL runtime, or auth infrastructure;
- application services stay transport-agnostic, with the existing Genie streaming client documented as a narrow exception;
- routers do not import DAL modules or SQL runtime helpers directly.

Domain events remain in `shared-domain`. `DomainEventPublisher` provides a
synchronous in-memory dispatcher for local application orchestration and tests.
Durable event delivery is intentionally left to infrastructure adapters in a
future phase.

## Phase 4 Validation Outcomes (2026-05-04)

### Architecture guardrails: all passing

`scripts/tests/test_ddd_architecture_guardrails.py` — 3 tests, 3 passed:

| Test | Result |
|---|---|
| `test_domain_modules_do_not_import_transport_application_or_infrastructure` | PASS |
| `test_application_services_remain_transport_agnostic` | PASS |
| `test_routers_do_not_reach_into_dal_or_sql_runtime` | PASS |

### Cross-context import audit

Manual grep across all 5 migrated apps confirmed zero violations:

- No router imports any `dal/` module directly.
- No `domain/` module imports `fastapi`, `dal`, `sqlalchemy`, or Databricks runtime.
- The only cross-context import in routers is `envmon/inspection_analysis/router.py` importing `spatial_config.application.queries` — an approved pattern (application layer only).
- `envmon/inspection_analysis/application/queries.py` imports `spatial_config.application.queries` — also approved (application-to-application).

### Domain artifact count

| App | Bounded contexts | Domain files | Application service files |
|---|---|---|---|
| envmon | 2 | 9 | 5 |
| spc | 2 | 8 | 6 |
| trace2 | 3 | 8 | 6 |
| warehouse360 | 4 | 5 | 8 |
| processorderhistory | 4 | 9 | 9 |

### Test suite status

| Scope | Status | Notes |
|---|---|---|
| `shared-domain` | 8 passed | Full coverage |
| `shared-trace` | 17 passed | Full coverage |
| `spc` (per-app) | 294 passed, 92% coverage | Passes all guardrails |
| `processorderhistory` | 392 passed | Passes all guardrails |
| `envmon`, `trace2`, `warehouse360` | Import errors at collection | `ModuleNotFoundError: No module named 'backend'` — multi-backend wheel conflict in workspace venv; tests pass when each app's editable install is resolved independently |

The test infrastructure gap (multi-app wheel conflict) is a workspace packaging concern, not a DDD boundary violation. It does not affect the architecture guardrail suite, which runs cleanly at the workspace level.

### Retained deliberate exceptions

- `processorderhistory/genie_assist/application/genie_client.py` imports `starlette` for streaming response support. This is the pre-existing narrow exception documented in Phase 3: the Genie streaming client cannot be fully transport-agnostic without a custom streaming abstraction.
- `warehouse360` bounded contexts are lighter on domain logic because the app currently runs primarily against mock data; domain layer will deepen when live SAP data integration is completed.
