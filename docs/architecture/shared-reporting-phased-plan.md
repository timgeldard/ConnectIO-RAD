# Shared Reporting Phased Plan

This plan turns ConnectIO RAD reporting into a shared, reusable capability
without building a large framework ahead of real app pressure. The first goal is
to extract the proven SPC and shared-ui patterns into a small
`shared-reporting` library, migrate one real dashboard, and only then add
generators, backend reporting helpers, and broader governance.

## Implementation Status

Updated: 2026-05-10 (session 4).

- Phase 0: Complete.
- Phase 1: Complete. Library includes Zod dashboard schemas, inferred types,
  typed widget registry, `ReportingDashboard` (uses `safeParse` for graceful
  validation fallback), `ReportPageShell`, `DashboardFilterProvider`,
  `useCodexQuery`, and `KpiCardWidget`.
- Phase 2: Complete. All first-wave widgets shipped: `KpiCardWidget` (with
  `progressBar` prop), `TrendChartWidget`, `BarChartWidget`, `ParetoChartWidget`,
  `SPCControlChartWidget`, `DrillDownTableWidget`. Shared ECharts core, theme,
  `EChart` (with per-instance `testId` prop), and `ChartContainer` are exported.
  16 unit/integration tests pass. `defaultRegistry` maps all six type keys.
  `ReportingDashboard` now supports optional `minColumnWidth` layout field for
  `repeat(auto-fit, minmax(Npx, 1fr))` grids alongside fixed-column mode.
- Phase 3: Complete. Three production app slices proven and test-backed:
    1. SPC scorecard: KPIs render through `ReportPageShell`, `ReportingDashboard`,
       and shared `kpi` widget; filters hydrated from SPC context; MSW integration
       test proves full fetch-to-render path without live API.
    2. Warehouse360 ControlTower: 6-card KPI strip migrated to `KpiCardWidget`
       inside the existing responsive `kpi-grid` CSS class, preserving tablet
       breakpoints; `progressBar` prop added to `KpiCardWidget` (fixing pre-
       existing `barPct`/`barTone` type mismatch). 4 ControlTower rendering tests
       prove all KPI labels and live data values flow through `KpiCardWidget`.
    Finding: `ReportingDashboard` fixed-column limitation resolved via opt-in
    `minColumnWidth`; widgets remain portable without `ReportingDashboard` as host.
    SPC interactive control chart migration deliberately skipped: widget contract
    is for dashboard summaries; interactive view has 9 chart types with EWMA
    per-point UCL/LCL incompatible with flat `SPCControlLimits` shape.
- Phase 4: Complete (audit). Backend extraction work is largely already done in
  `shared-api` and `shared-db` (error normalization, auth, data freshness,
  DAL pattern, middleware). No new shared library extraction is warranted.
  `attach_data_freshness()` is already shared (94 call sites). Remaining gap:
  `PlantScope` classes are duplicated per-app — candidate for `shared-db`
  consolidation when a third app adopts plant-scoped queries.
- Phase 5 onward: Not started. Generators, Storybook, and governance deferred.

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

- Complete: `KpiCard` (with `progressBar` prop)
- Complete: `ChartContainer`
- Complete: `TrendChart`
- Complete: `BarChart`
- Complete: `ParetoChart`
- Complete: `SPCControlChart`
- Complete: `DrillDownTable`

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
- Complete: `SPCControlChart`, `BarChart`, `ParetoChart`, and `DrillDownTable`
  are implemented with empty/populated states and registered in `defaultRegistry`.
  Bundle-impact validation deferred to Phase 4.

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
  `ReportPageShell`, `ReportingDashboard`, and shared-reporting `kpi` widgets.
- Partial: pilot page table still uses the existing lazy SPC table, which is the
  right boundary for this slice.
- Complete for scorecard slice: MSW integration test proves full fetch-to-render
  path for scorecard/plants/characteristics without live API.
- Complete for warehouse360 slice: ControlTower KPI strip uses `KpiCardWidget`
  inside existing responsive `kpi-grid`; `@connectio/shared-reporting` dependency
  declared in `apps/warehouse360/frontend/package.json`.
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

Status: Audit complete (2026-05-10). No new extraction warranted at this time.

**Audit findings:**
- Response envelopes are domain-keyed per app (`{"scorecard": [...]}`, `{"bins": [...]}`,
  `{"oee_analytics": {...}}`). A uniform wrapper would reduce clarity; reject.
- Error handling, auth, data freshness (`attach_data_freshness()`, 94 call sites),
  middleware, and DAL patterns are all already in `shared-api`/`shared-db`.
- Cursor-based pagination exists in SPC only; no cross-app pattern yet.
- `PlantScope` logic is the one genuine duplicate across apps. Consolidate in
  `shared-db` when a third app adopts plant-scoped queries.

**Deferred scope (unchanged):**
- Large-result handling as a separate `shared-db` design item.
- Audit trail logging (request-scoped via middleware is sufficient for now).
- No raw SQL/template input from frontend (already enforced by DAL pattern).

Acceptance criteria:

- Audit: Complete. No regressions introduced.
- `PlantScope` consolidation: Deferred to when a third app requires it.
- Large-result behavior: Deferred; design independently with auth/expiry tests.

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
- Documentation includes â€œhow to add a dashboardâ€ and â€œhow to add a widgetâ€.

## Explicit Non-Goals For The First Pass

- No drag-and-drop dashboard builder.
- No dashboard persistence store.
- No second charting stack unless a concrete use case proves ECharts is the
  wrong tool.
- No broad Tailwind rollout.
- No raw SQL/template editor.
- No global i18n rewrite bundled into the first dashboard migration.

## Immediate Next Step

Updated: 2026-05-10 (session 6).

Phases 0-4 complete. Phase 6 POH third-app proof complete (sessions 5–6).

Recent completions (session 6):
- Vitest environment fixed: `@rolldown/binding-win32-x64-msvc@1.0.0-rc.18`
  installed; all test suites restored (2/2 POH, 49/49 W360, 16/16 shared-reporting).
- `deltaPct(current, prior)` and `mapTone(t)` pure helpers exported from
  `analyticsShared.tsx`; replace `DeltaPill` at all three analytics pages without
  requiring a `deltaTone` prop addition to `KPI` / shared-ui.
- `PourAnalyticsPage`, `YieldAnalyticsPage`, `QualityAnalyticsPage` KPI strips
  all migrated to `KpiCardWidget`; `DeltaPill` removed from all three files.
- 10/10 `AnalyticsKpiStrips.test.tsx` tests pass (5 unit, 5 render).
- POH frontend typecheck clean.

Recent completions (session 5):
- `KpiCardWidget` extended with `icon?: IconName` prop (passes through to `KPI`).
- POH `PourKpiCards` 3-card strip migrated to `KpiCardWidget`.
- `@connectio/shared-reporting` declared in POH `package.json`.
- 2 `PourKpiCards` rendering tests written; typechecks pass.

Recent completions (session 4):
- Phase 4 backend audit: no new extraction warranted; `PlantScope` deferred.
- SPC chart migration deliberately skipped: `SPCControlChartWidget` is a
  dashboard-summary contract incompatible with the interactive control chart view.
- `ReportingDashboard` responsive layout: `minColumnWidth?: number` added.
- ControlTower: 4 `KpiCardWidget` rendering tests pass.

Candidate next steps:

1. **Phase 5 generators**: widget and report-page generators, now that three app
   migrations (SPC, W360 ControlTower, POH) have confirmed stable `KpiCardWidget`
   shapes.
2. **Storybook or visual regression**: 6 widgets stable across three apps — a
   Storybook snapshot catalog would give visual regression coverage.
3. **ConnectedQuality migration**: Phase 6 item 4 — CQ dashboard pages remain.

