# Shared Reporting Phased Plan

This plan turns ConnectIO RAD reporting into a shared, reusable capability
without building a large framework ahead of real app pressure. The first goal is
to extract the proven SPC and shared-ui patterns into a small
`shared-reporting` library, migrate one real dashboard, and only then add
generators, backend reporting helpers, and broader governance.

## Implementation Status

Updated: 2026-05-10.

- Phase 0: Complete. `libs/shared-reporting` exists as an Nx/workspace library
  using the same lightweight shared-library conventions as `shared-ui`.
- Thin Phase 1 skeleton: Complete. The library now includes Zod dashboard
  schemas, inferred TypeScript types, a typed widget registry,
  `CodexDashboard`, `ReportPageShell`, `DashboardFilterProvider`,
  `useCodexQuery`, and a first `kpi` widget backed by shared-ui.
- Verification: `shared-reporting:typecheck`, `shared-reporting:test`, and a
  broader typecheck over `shared-reporting`, `shared-ui`, `platform-frontend`,
  and `processorderhistory-frontend` pass.
- Phase 2: Started. Shared-reporting now owns the reusable ECharts core,
  reporting chart theme, `EChart`, `ChartContainer`, and a first `trend` widget.
  The SPC app still uses its local chart shim until chart-specific migration to
  avoid mixing extraction work with existing SPC type debt. Focused
  `TrendChartWidget` coverage is in place.
- Phase 3: Started. The SPC scorecard summary KPIs now render through
  `ReportPageShell`, `CodexDashboard`, and the shared `kpi` widget while keeping
  the existing SPC scorecard data hook and lazy table intact. SPC's local
  `charts/EChart` adapter now delegates to shared-reporting's `EChart`, so
  existing chart surfaces use the shared wrapper without broad component churn.
  The SPC Compare grouped bar chart now uses shared `ChartContainer` for its
  result panel. The SPC scorecard pilot hydrates `DashboardFilterProvider` from
  the current material, plant, and date scope and renders that scope in the
  shell filter slot.
- Phase 4 onward: Not started. Backend helpers, generators, Storybook, and
  broad migration remain deferred until the pilot proves the contracts.

## Principles

- Prefer existing repo patterns over greenfield tooling.
- Build the smallest shared layer that one production dashboard can prove.
- Keep SQL in app/shared DAL layers; do not introduce free-form SQL templating.
- Use Kerry design-system CSS variables and shared-ui primitives.
- Use TanStack Query where it is already established; avoid extra state stores
  unless dashboard editing or persistence creates a real need.
- Use Apache ECharts as the primary chart engine by extracting the existing SPC
  wrapper/theme path.
- Defer generators until the target file shapes have been used manually at
  least once.

## Phase 0: Foundation And Repo Wiring

Target: 1 to 2 days.

Status: Complete.

Create `libs/shared-reporting` in the existing shared-library style rather than
assuming `@nx/react` is available.

Initial structure:

```text
libs/shared-reporting/
  package.json
  project.json
  tsconfig.json
  src/
    core/
    components/
    hooks/
    schema/
    utils/
    widgets/
    index.ts
  README.md
```

Scope:

- Add `libs/shared-reporting` to root `package.json` workspaces.
- Add Nx `project.json` with a `typecheck` target matching `shared-ui`.
- Add package exports for `.` and selected subpaths only when needed.
- Define initial public API boundaries in `src/index.ts`.
- Document ownership: shared-reporting owns reusable reporting primitives, not
  app-specific dashboards or backend SQL.

Acceptance criteria:

- Complete: `npm install` workspace resolution includes
  `@connectio/shared-reporting`.
- Complete: `nx run shared-reporting:typecheck` passes.
- Complete: no app imports from deep internal paths.

## Phase 1: Minimal Reporting Core

Target: Week 1.

Status: Thin skeleton complete; first SPC pilot slice wired.

Build the declarative layer, but keep it intentionally boring.

Core types and schemas:

- `DashboardConfig`
- `WidgetConfig`
- `DataSourceConfig`
- `FilterConfig`
- `InteractionConfig`

Implementation:

- Zod schemas live in `src/schema`.
- TypeScript types are inferred from schemas and re-exported from `src/core`.
- Widget registry is explicit and typed:

```ts
registerWidget("kpi", KpiCardWidget)
registerWidget("trend", TrendChartWidget)
```

- `CodexDashboard` renders a validated config through the registry.
- Layout v1 uses CSS Grid with responsive column rules. No resizable panels yet.

Report shell:

- `ReportPageShell`
- title and description region
- filter slot
- refresh action
- export slot
- consistent loading, error, empty, and permission states

Filter context:

- `DashboardFilterProvider`
- `useDashboardFilters`
- standard filter value types for plant, time range, material, status, and
  custom key/value filters
- URL param sync for shareable dashboards
- optional Platform Shell context hydration

Data hook:

- `useCodexQuery` built on TanStack Query v5
- normalizes loading, empty, permission, and backend error states
- supports configurable stale time and background refetch
- does not invent a second app-wide query client

Acceptance criteria:

- Complete: a static demo dashboard config renders in a Vitest fixture.
- Partial: invalid widget config fails with Zod schema errors; user-facing error
  presentation should be refined during the pilot.
- Complete: filters serialize to URL params; hydration from URL/platform context
  should be expanded during the pilot.
- Complete: no Zustand/Jotai dependency introduced in this phase.

## Phase 2: First Widget Set And SPC Extraction

Target: Week 1 to Week 2.

Status: Started; shared ECharts base, chart container, and first trend widget
are implemented. The first SPC pilot uses the shared KPI/report shell path; SPC
chart migration remains next.

Primary chart technology is Apache ECharts. Extract/adapt the existing SPC
ECharts wrapper and theme rather than introducing a second chart stack.

Initial widgets:

- Complete: `KpiCard`
- Complete: `ChartContainer`
- Complete: `TrendChart`
- `BarChart`
- `ParetoChart`
- `SPCControlChart`
- `DrillDownTable`

Rules:

- Each widget accepts a typed `WidgetConfig`.
- Each widget exposes accessible labels and empty/error states.
- SPC chart rules should reuse proven SPC calculations where possible rather
  than rewriting Western Electric/Nelson logic inside React components.
- Tables start with simple rendering. TanStack Table v8 and virtualization are
  introduced only when the pilot dataset requires it.

Deferred widgets:

- heatmap
- gauge
- histogram
- saved views
- dashboard editing
- resizable panel layout

Acceptance criteria:

- Complete: shared-reporting exports a reusable ECharts core, theme, and
  `EChart` wrapper.
- Complete: `KpiCard` has fixture coverage through `CodexDashboard`;
  `TrendChart` has component coverage for populated and empty states.
- Pending: `SPCControlChart` and bundle-impact validation wait for the SPC pilot.

## Phase 3: Pilot Dashboard Migration

Target: Week 2.

Pick one real dashboard as the proving slice. Preferred options:

- SPC scorecard/control chart pilot if chart complexity is the main risk.
- Warehouse360 operations cockpit pilot if operational cockpit value is the main
  risk.

Recommended first pilot: SPC, because it already uses ECharts and has the
highest charting complexity.

Pilot scope:

- Replace one existing SPC reporting page with `ReportPageShell`,
  `CodexDashboard`, shared filters, and two to four shared widgets.
- Keep existing backend endpoints.
- Keep existing DAL/query behavior.
- Do not introduce shared-reporting-api yet.

Acceptance criteria:

- Complete for scorecard KPI slice: SPC scorecard summary KPIs render through
  `ReportPageShell`, `CodexDashboard`, and shared-reporting `kpi` widgets.
- Partial: pilot page table still uses the existing lazy SPC table, which is the
  right boundary for this slice.
- Complete for slice: focused `ScorecardView` test passes.
- Complete for slice: SPC chart surfaces now use the shared `EChart` wrapper
  through the existing local adapter.
- Complete for slice: SPC Compare grouped bar chart uses shared
  `ChartContainer` for populated and empty states.
- Complete for slice: SPC scorecard hydrates shared reporting filters from
  existing SPC context.
- Partial: browser smoke validation confirms the SPC shell loads without
  frontend runtime failure. Data-backed visual validation is blocked locally by
  the SPC API proxy returning connection refused for scorecard/plants/
  characteristics endpoints.
- New shared-reporting tests cover the extracted widgets.
- User can deep link with filters intact.
- No regression in app build or typecheck. Note: full SPC typecheck still has
  pre-existing unrelated errors in `SPCPage`/layout and is tracked separately.

## Phase 4: Backend Reporting Helpers

Target: Week 2 to Week 3, after the pilot proves frontend contracts.

Add backend helpers only for repeated patterns found in the pilot and one second
candidate app.

Scope:

- Add shared query result envelopes for reporting endpoints.
- Add error normalization helpers if repeated across apps.
- Add audit logging helpers only if current app audit patterns converge.
- Add large-result handling as a separate `shared-db` design item.

Large result handling should be designed independently:

- preserve current small-result API behavior
- detect/flag large results
- return external-link metadata or streaming handles only through explicit
  endpoint contracts
- test permission and expiry behavior before rollout

SQL guidance:

- Continue to use DAL modules, `tbl()` helpers, and named parameters.
- Avoid Jinja2/Mustache SQL templating in v1.
- If templates become necessary, use allowlisted templates and parameter maps,
  never arbitrary string interpolation.

Acceptance criteria:

- Backend helpers remove duplication from at least two apps.
- No endpoint accepts raw SQL or raw template input from the frontend.
- Large-result behavior has tests for auth, expiry, and empty/error cases.

## Phase 5: Generators And Governance

Target: Week 3+, after two manual migrations.

Only create generators once the file shapes are stable.

Candidate generators:

```bash
nx g @connectio/codex:report-page --name=warehouse-cockpit
nx g @connectio/codex:dashboard --name=quality-kpi
nx g @connectio/codex:widget --type=spc-chart
```

Defer `gold-view` generator until data-platform conventions are agreed and used
outside a single app.

Governance updates:

- New reporting features should use `shared-reporting` unless there is a
  documented exception.
- Widgets must include JSDoc and accessible labels.
- Core widget strings must be i18n-ready at creation.
- App-specific migrations follow the current app i18n pattern; broader i18n
  backfill remains a separate workstream.
- Dashboard configs must validate with Zod before rendering.

Acceptance criteria:

- Generator output builds and typechecks without manual cleanup.
- GEMINI.md documents reporting expectations without blocking existing legacy
  pages.
- Repo validation can distinguish new shared-reporting code from legacy
  migration backlog.

## Phase 6: Broader Migration And Hardening

Target: Week 3 onward.

Migration order:

1. SPC charting and scorecard surfaces.
2. Warehouse360 cockpit KPI/table dashboards.
3. POH analytics pages.
4. ConnectedQuality dashboard pages.

Hardening:

- visual regression checks for shared widgets
- performance benchmarks with representative Databricks result sizes
- accessibility checks for widget keyboard/focus behavior
- documentation and dashboard examples
- optional Storybook only after the widget catalog has enough real components to
  justify the dependency

Acceptance criteria:

- At least two apps use shared-reporting without app-specific hacks.
- Widget APIs remain stable across two migrations.
- Performance benchmarks show no material regression against current pages.
- Documentation includes “how to add a dashboard” and “how to add a widget”.

## Explicit Non-Goals For The First Pass

- No drag-and-drop dashboard builder.
- No dashboard persistence store.
- No second charting stack unless a concrete use case proves ECharts is the
  wrong tool.
- No broad Tailwind rollout.
- No raw SQL/template editor.
- No global i18n rewrite bundled into the first dashboard migration.

## Immediate Next Step

Continue Phase 2/3 as the next vertical slice:

1. Run data-backed visual validation for SPC scorecard and Compare once the SPC
   backend or a supported local API fixture is available.
2. Keep existing SPC backend endpoints unchanged until the frontend contracts
   are proven.
