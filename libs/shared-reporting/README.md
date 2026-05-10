# @connectio/shared-reporting

Shared reporting primitives for ConnectIO RAD dashboards.

This package owns reusable reporting contracts, dashboard rendering primitives,
filter state, report shell components, and generic widgets. App-specific
queries, dashboard configs, and domain behavior stay inside the owning app until
they prove reusable across at least two apps.

## Current Scope

- Zod-backed dashboard config schemas
- typed widget registry
- `CodexDashboard` renderer
- `ReportPageShell`
- `DashboardFilterProvider`
- `useCodexQuery`
- shared ECharts core/theme wrapper
- `ChartContainer`
- `kpi` and `trend` widgets

## Deferred

- SPC control chart widget
- table virtualization
- resizable layouts
- dashboard persistence
- generators
