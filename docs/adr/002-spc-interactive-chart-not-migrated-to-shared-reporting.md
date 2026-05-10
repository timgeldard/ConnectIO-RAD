# ADR 002: SPC Interactive Control Chart Excluded from shared-reporting Widget Contract

## Status

Accepted.

## Context

The `shared-reporting` library (phases 0–3, May 2026) introduced a `SPCControlChartWidget`
for rendering SPC control charts inside `ReportingDashboard`. The widget accepts a flat
`SPCControlLimits` shape: a single set of static UCL/CL/LCL values and optional 1σ/2σ
boundaries that apply uniformly to the whole series.

The SPC app's interactive control chart view is a different beast:

- **9 chart sub-types** (Xbar-R, Xbar-S, IMR, p, np, c, u, EWMA, CUSUM).
- **Per-point dynamic limits** — EWMA and CUSUM compute UCL/LCL as a rolling function
  of the preceding data points, so limits change with every sample.
- **Interactive UX** — rule-violation drill-down, sample exclusion toggle, parameter
  editing, and cross-chart navigation are first-class features, not dashboard summaries.
- **Existing test coverage** — the SPC control chart is well-covered by its own
  integration tests and is not a source of known defects.

Forcing the interactive view into the widget contract would require either (a) extending
`SPCControlLimits` with per-point arrays — making it unfit for its primary dashboard use
case — or (b) building a parallel bespoke wrapper that duplicates the widget shell for
no user-visible benefit.

## Decision

The SPC interactive control chart view remains a standalone bespoke component in
`apps/spc/frontend`. It does not adopt `SPCControlChartWidget` or `ReportingDashboard`
as its host.

`SPCControlChartWidget` is intended for **dashboard summary panels** where a static limit
set and a single chart type are sufficient. Any new dashboard-style SPC summary card
(e.g., a plant-level quality cockpit) should use the shared widget. The interactive
analysis view should stay bespoke.

## Consequences

- **Positive**: `SPCControlLimits` stays clean and fit for its dashboard purpose. No
  churn in the SPC frontend; no regression risk on a well-tested component.
- **Negative**: Two control-chart rendering paths exist in the repo. A future contributor
  working on the SPC frontend should read this ADR before assuming the widget contract
  can be extended to cover interactive use cases.
- **Revisit trigger**: If a third app needs per-point dynamic limits in a dashboard
  context, that is the right time to re-evaluate whether `SPCControlLimits` should
  evolve or whether a separate `SPCDynamicChartWidget` is warranted.
