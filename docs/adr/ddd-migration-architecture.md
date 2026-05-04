# ADR: Pragmatic DDD Migration Boundaries

## Status

Accepted.

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
