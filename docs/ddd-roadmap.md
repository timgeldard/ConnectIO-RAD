# Comprehensive DDD Stabilization Roadmap

This document outlines the complete plan to finalize the Domain-Driven Design (DDD) migration across the ConnectIO-RAD monorepo.

## Phase 0: Assessment & Inventory (Completed)
- [x] Map Current State: Inventory all apps and shared libs.
- [x] Define Bounded Contexts: Update context maps and identify gaps.
- [x] Create Domain Glossary (`docs/domain-glossary.md`).

## Phase 1: Establish DDD Foundations in Shared Libraries (Completed)
- [x] Introduce standard DDD building blocks (`shared-domain` library): `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `Repository`.
- [x] Enrich core domain models in `shared-trace` (Batch, Material).
- [x] Ensure models are pure with 100% test coverage for domain logic.

## Phase 2: Migrate Individual Apps (Completed)
*Objective: Transform anemic models into rich domain models with proper application services orchestrating repositories and domain logic.*

**Per-App Migration Pattern:**
1.  Create/Enrich `domain/` folder (Entities, Aggregates, Value Objects, Domain Services, Events).
2.  Refactor application services (`application/`) to orchestrate domain objects.
3.  Keep FastAPI routers thin.
4.  Introduce Anti-Corruption Layers for external integrations.
5.  Update frontend TypeScript clients to reflect domain language.

**Prioritization:**
- [x] **`trace2`**: Complete the migration of its bounded contexts (`batch_trace`, `lineage_analysis`, `quality_record`).
- [x] **`spc`**: Enrich chart config and process control contexts.
- [x] **`envmon`**: Enrich inspection analysis and spatial config contexts.
- [x] **`warehouse360`** & **`processorderhistory`**: Enrich the newly created but formerly anemic context structures.

## Phase 3: Stabilization & Cross-Cutting Concerns
- [ ] **Ubiquitous Language Enforcement**: Update docs, comments, and variable names to use consistent domain terms.
- [ ] **Event-Driven Foundations**: Define domain events in shared lib; implement basic in-memory publishing.
- [ ] **Testing Strategy**: Segregate tests into Domain unit tests (no DB), Repository integration tests, and Application service tests with mocks.
- [ ] **Dependency Rules**: Enforce rules via linting (Domain cannot depend on infrastructure or application layers).

## Phase 4: Validation, Documentation & Handover
- [ ] **ADR**: Document the final DDD approach.
- [ ] **Per-App Docs**: Update READMEs and architecture diagrams.
- [ ] **Regression Suite**: Full test run.
- [ ] **Code Review / Pairing**: Sessions on complex aggregates.
- [ ] **Success Measurement**: Validate reduced cross-context imports and easier onboarding.
