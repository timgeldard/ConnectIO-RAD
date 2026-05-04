# ADR 001: DDD Read-Model Boundaries for Trace2

## Status
Accepted

## Context
Trace2 was originally implemented with a flat router/DAL structure. As the application grew to support 9+ specialized traceability views, the `trace.py` router and `trace_dal.py` became bloated and difficult to maintain. We needed a way to organize code around business capabilities (Bounded Contexts) while preserving high-performance read access to Databricks SQL.

## Decision
We have migrated Trace2 to a DDD-lite / Modular Monolith architecture using three bounded contexts:
- `batch_trace`: Identity and core traceability.
- `lineage_analysis`: Deep supply chain traversal and risk.
- `quality_record`: Quality results and production history.

We use a CQRS-lite pattern where:
1. **Routers** handle HTTP concerns and map generic exceptions to status codes.
2. **Application Services** handle response composition (freshness) and coordinate between Domain and DAL.
3. **Domain Models** encapsulate business invariants (identity validation, status normalization, risk calculation).
4. **DAL Adapters** wrap the shared traceability engine.

## Consequences
- **Improved Maintainability**: Changes to quality status logic are isolated to the `quality_record` context.
- **Testability**: Domain logic can be unit-tested without mocks for FastAPI or Databricks.
- **Architectural Integrity**: Dependency rules prevent infrastructure details (SQL, FastAPI) from leaking into business logic.
- **Shared Library Dependency**: `libs/shared-trace` remains a centralized dependency for giant SQL queries for now. A future ADR will address splitting this library if it becomes a bottleneck.
