# ADR-006: shared-reporting promoted to production

- **Status:** Accepted — in production use
- **Date:** 2026-05-14

## Context

`libs/shared-reporting` contains:

- **ECharts integration** — `EChart.tsx`, `echartsTheme.ts`, `echartsCore.ts` (tree-shaken ECharts bundle)
- **Composable dashboard system** — `DashboardBuilder`, `BoundWidgetRenderer`, `DashboardGrid`, `ComposableDashboard`, `PropertyInspector`, dashboard `store`
- **Traceability view components** — `TraceFilterControls`, `viewState`, `geniePrompt`
- **Widget registry** — `registry.ts`, `types.ts`

At the time of this decision the library has active consumers:

| App | What it uses |
|---|---|
| `apps/spc/frontend` | `EChart`, `echartsTheme`, `echartsCore` |
| `apps/platform/frontend` | `ComposableDashboard`, `DashboardGrid`, query catalog widgets, `ReportingDashboard` |

ADR-002 excluded the SPC interactive control chart from the shared-reporting widget contract — that decision stands. SPC uses only the ECharts integration layer, not the composable dashboard system.

## Decision

Promote `shared-reporting` to production status. No library move, no deprecation, no playground migration. It is an active shared dependency.

The composable dashboard system (platform shell) and the ECharts integration (SPC) are distinct use cases served by the same library. They are coupled only at the registry/type boundary, which is intentional.

## Consequences

- `shared-reporting` is a first-class shared dependency subject to the same breaking-change controls as `shared-db`, `shared-api`, and `shared-auth`.
- Changes to `EChart`, `echartsTheme`, or `echartsCore` may affect SPC charts and must include SPC smoke tests.
- Changes to the composable dashboard system (`DashboardBuilder`, `store`, `registry`) may affect the platform shell dashboards panel and must include platform frontend tests.
- Widget contract additions follow ADR-002: SPC control charts are excluded; all other data-viz widgets may be onboarded to the registry with an explicit widget descriptor.
