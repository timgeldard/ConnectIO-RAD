# Consolidation Roadmap & Architectural Alignment Plan

## 1. Executive Summary
The ConnectIO-RAD monorepo has a solid architectural foundation, but rapid feature development across multiple apps has led to significant duplication, particularly in frontend components, plant context management, and backend caching/query patterns.
Consolidating smartly is essential for:
- Reducing technical debt
- Ensuring consistent UX
- Improving performance and scalability toward 500 concurrent users
- Maintaining clean DDD boundaries

**Top 5 Recommendations:**
1. Aggressively consolidate UI primitives into `shared-ui`.
2. Centralize Plant & Workspace Context into a new dedicated library (`shared-app-context`).
3. Elevate advanced caching and query patterns from SPC into `shared-db`.
4. Standardize common query builders, filters, and pagination.
5. Carefully expand domain models within existing libraries first (`shared-domain` + `shared-trace`) before creating any new broad domain library.

## 2. Current Shared Libraries Assessment

| Library | Status | Assessment & Adoption |
| :--- | :--- | :--- |
| `shared-ui` | Mature but underused | Excellent primitives exist, but adoption is low. Multiple apps duplicate Card, KPI, AppShell, etc. |
| `shared-db` | Healthy but extended | Core SQL runtime is good; however, valuable caching and query logic is trapped in app-specific wrappers. |
| `shared-trace` | Strong & focused | Excellent for traceability. Should serve as the model for domain sharing. |
| `shared-auth` | Good | Handles token passthrough and UC policies well. |
| `shared-api` | Mature | Solid FastAPI standardization. |
| `shared-frontend-api` | Good | Room to grow for shared DTOs. |

## 3. Detailed Findings (Duplication Heat Map)

### 🔴 High Duplication
- **Plant / User Context Management (Frontend):** Duplicated in `warehouse360`, `spc`, `envmon`, `processorderhistory`, and `platform`.
- **UI Primitives & Layout Components:** `Card`, `KPI`, `AppShell`, Status indicators, `ErrorBoundary`, `GlobalFilterBar`, etc.
- **Error Handling & Exception Mapping:** Repeated patterns for Databricks SQL errors, authorization failures, and business rule violations.

### 🟡 Medium Duplication
- **Caching Strategies:** Sophisticated tiered caching exists only in `spc/backend`.
- **Query Patterns:** Pagination, authorized plant filtering, date-range, material/batch filters, and query tagging.
- **Common Manufacturing Concepts:** `PlantScope`, `GoodsMovement`, `BatchSummary`, `MaterialIdentifier`, etc.

### 🟢 Low / Acceptable
- App-specific business logic (SPC chart rules, Warehouse360 bin operations, etc.).

## 4. Consolidation Roadmap

### Phase 1: UI & Context Consolidation (Status: In Progress)
*High impact, low risk, immediate developer experience wins.*

| Action | Target Library | Effort | Expected Benefit |
| :--- | :--- | :--- | :--- |
| Delete local copies of `Card`, `KPI`, `AppShell`, `Icon`, `StatusPill`, `ErrorBoundary`, `PageHead` and replace with `shared-ui` | `shared-ui` | Medium | Design consistency + smaller bundle sizes |
| Extract `PlantProvider`, `usePlants`, `PlantContextBar`, and workspace context logic | `shared-app-context` (New) | Small | Single source of truth for authorization and cross-app context |
| Standardize `GlobalFilterBar` and common table patterns | `shared-ui` + `shared-frontend-api` | Small | Consistent UX across all cockpits |

### Phase 2: Backend Performance Foundations
*Critical for scaling to 500 concurrent users.*

| Action | Target Library | Effort | Expected Benefit |
| :--- | :--- | :--- | :--- |
| Migrate tiered caching, TTL logic, and pattern-based cache keys from SPC into core | `shared-db` | Medium | All apps benefit from production-grade caching |
| Add standardized query builders (pagination, plant filtering, query tagging, Liquid Clustering hints) | `shared-db` | Medium | Better performance, observability, and cost control on Databricks |
| Centralize error mapping, business exceptions, and API response standards | `shared-api` + `shared-domain` | Small | Consistent error handling and better UX |
| Remove unit tests in apps that test shared library internals | — | Small | Reduce false coupling |

### Phase 3: Domain Model Maturation
*Future / Ongoing*

| Action | Target Library | Effort | Expected Benefit |
| :--- | :--- | :--- | :--- |
| Expand `shared-domain` and `shared-trace` with common Value Objects (`PlantScope`, `MaterialId`, `Quantity`, `GoodsMovement`, etc.) | `shared-domain` / `shared-trace` | Medium | Stronger ubiquitous language without over-coupling |
| Only create `shared-manufacturing` if clear need emerges after Phase 1 & 2 | (Only if justified) | Large | Avoid premature broad libraries |

## 5. New Shared Libraries Proposed

### `libs/shared-app-context` (Priority: High)
- **Contains:** `Plant`/workspace context, auth-derived state, cross-app synchronization hooks.
- **Rationale:** Distinct concern from pure UI (`shared-ui`) and raw API calls (`shared-frontend-api`).

### No broad `shared-manufacturing` yet
- Prefer enhancing `shared-domain` and `shared-trace` first to maintain DDD discipline.

## 6. Implementation Guidelines

### Nx Practices:
- Use `nx generate` for new libraries.
- Enforce strict module boundaries with ESLint + Nx constraints (ban direct imports from `apps/*/src` into other apps).
- Tag libraries properly (`scope:shared`, `type:ui`, `type:domain`, etc.).

### Deprecation Policy:
- Mark duplicated components as `@deprecated` with clear migration path.
- Remove deprecated code after 2 releases or 8 weeks (whichever comes first).

### Testing & Quality:
- Shared libraries must maintain ≥ 90% test coverage.
- Applications must not test internal behavior of shared libraries.
- Add automated duplication detection in CI (e.g., `nx affected` + custom scripts).

### Databricks-Specific:
- Shared query builders should inject query tags (`/* App=warehouse360, Module=inventory */`).
- Include support for Liquid Clustering column suggestions and cost-aware query patterns.

## 7. Risks & Success Metrics

### Risks & Mitigations:
- **Over-coupling:** Mitigation — Shared libraries must remain stable abstractions (interfaces, value objects, utilities). No business rules that belong in app bounded contexts.
- **Migration friction:** Mitigation — Strong deprecation policy + automated search/replace where safe.
- **Performance regression:** Mitigation — Measure cache hit ratios and query latency before/after changes.

### Success Metrics:
- Net reduction in codebase size (target: -8% to -15% LOC after Phase 1+2).
- Frontend bundle size reduction of ≥ 20% per app.
- ≥ 30% improvement in Databricks SQL cache hit ratio.
- Plant context change implemented in only one place.
- Zero new duplicated UI components in future PRs.
