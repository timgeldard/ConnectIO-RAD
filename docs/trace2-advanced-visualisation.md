# trace2 advanced traceability visualisation

- **Status:** Phase 0 + Phase 1 scaffold shipped; Phases 2–4 not started
- **Date:** 2026-05-12
- **Owner:** TBD (trace2 frontend lead)

## What this is

The classic SVG `LineageGraph` in `apps/trace2/frontend/src/components/`
remains the default for `BottomUp` and `TopDown` pages.  In parallel we
have shipped an `"advanced"` view powered by [React Flow][rf] +
[elkjs][elk] for cross-site / deep-graph investigations where the
hand-rolled column layout caps out.

Selecting **Advanced** in the graph view toggle renders the new
`AdvancedLineageGraph` from `libs/shared-reporting`.  Visual language is
intentionally aligned with the classic component (focal yellow accent,
link-type stroke colours) so a side-by-side comparison stays
cognitively cheap.

[rf]: https://reactflow.dev
[elk]: https://eclipse.dev/elk/

## What shipped in this PR

### Phase 0 — Foundation (complete)

- `libs/shared-reporting/src/traceability/types.ts`
  — `AdvancedLineageFocal`, `AdvancedLineageNode`, `AdvancedLineageData`,
  `LineageDirection`, link-type widening (graceful degradation for new
  backend link kinds).
- `libs/shared-reporting/src/traceability/graphTransformers.ts`
  — pure `buildLineageGraph(data, options)` converting the classic
  `{focal, upstream[], downstream[]}` shape to React Flow nodes/edges.
  Handles dedup, depth caps, self-transfer drop, orphan-edge cleanup.
  11 unit tests cover the transform behaviour.
- `libs/shared-reporting/src/traceability/layoutEngines.ts`
  — async wrapper around elkjs's layered algorithm, configurable
  direction (`LR` / `RL`), with a deterministic grid fallback if ELK
  throws so the UI never goes blank.
- `libs/shared-reporting/src/traceability/viewState.ts`
  — `TraceViewState` type, URL serialisation, `useTraceViewState`
  React hook with popstate sync and `history.replaceState` writes
  (shareable URLs without polluting browser history).  5 unit tests.

### Phase 1 — Core advanced graph (scaffold complete)

- `libs/shared-reporting/src/traceability/AdvancedLineageGraph.tsx`
  — production-ready component built on React Flow.  Features:
  custom focal + lineage node renderers matching the classic visual
  language, ELK auto-layout, minimap, fit-view, hidden attribution,
  click-to-select, async "Laying out…" hint, focal-id normalisation
  in the click callback.  Wrapped in its own `ReactFlowProvider` for
  drop-in use.  4 smoke tests.
- `libs/shared-reporting/src/traceability/HybridTraceabilityPanel.tsx`
  — switch-component that renders classic, advanced, side-by-side,
  or a placeholder for sankey/table.  Accepts the classic view as a
  render prop so `shared-reporting` does not need to know about
  trace2-specific components.
- `apps/trace2/frontend/src/components/GraphViewToggle.tsx`
  — extended the `GraphViewMode` union with `"advanced"`.
- `apps/trace2/frontend/src/pages/BottomUp.tsx` and `TopDown.tsx`
  — render `AdvancedLineageGraph` when the toggle selects it.  Both
  pages share the existing selection-state wiring.

## What is deliberately not in this PR

These were in the original 5-phase plan and are tracked for follow-up.
None of them are blocked by anything in this PR — the foundations were
designed so each one slots in without rework.

### Phase 1 finishing items

- **Smart node grouping** (collapse by Plant or Material Family).
  The `buildLineageGraph` API has room for a `groupBy` option; needs a
  UI for expand/collapse and a transform that builds compound nodes.
- **Depth slider + filter chips wired into `useTraceViewState`.**
  Today the consumer passes `maxUpstreamLevel` / `maxDownstreamLevel`
  as props; the URL-synced shared state is ready but the UI surfaces
  are not built yet.
- **Path analysis overlays.**  Stroke thickness scaled to qty, colour
  intensity by risk or age.  Requires either a new field on the
  lineage rows or a frontend roll-up.

### Phase 2 — Sankey + table views

- **`SankeyFlowView`.**  ECharts is already in `shared-reporting`'s
  dep tree, so the renderer is cheap; the blocker is that the lineage
  endpoint currently emits only per-node `qty` with no aggregated
  flow magnitude.  Either:
  1. Backend adds a `flow_qty` per edge in the lineage DAL, or
  2. Frontend rolls qty up per `(source, target, link)` tuple.
  Option (1) is correct long-term; option (2) is acceptable for a
  spike.  Add the field to the entities.yaml entry for
  `vw_gold_batch_lineage` before merging.
- **Table view** with the same filters + a CSV export.

### Phase 3 — Polish + manufacturing fit

- **Genie integration.**  Right-click a node → "Explain this transfer".
  Trace2 already wires Genie at the page level (see
  `apps/processorderhistory/.../genie_assist/`); the contract is
  stable, this is integration work only.
- **PNG / SVG / PDF export.**  React Flow exposes the viewport DOM
  node; html-to-image is the standard companion library.
- **High-contrast / factory-mode theming.**  Hook the CSS variables
  the custom node renderers already read from (`--ink-1`, `--line`,
  `--brand`).  Add a Vitest snapshot per theme.
- **Performance.**  Virtualise nodes when count exceeds ~150 (React
  Flow supports `onlyRenderVisibleElements`).  Lazy-load ELK for
  deep graphs (it is already async — we just don't show a busy state
  for re-layouts).

### Phase 4 — Validation

- **Visual regression** baselines via Playwright `toHaveScreenshot()`.
- **Synthetic graph benchmarks** at 50 / 100 / 200 nodes.  React Flow's
  `useNodesState` reconciler is the hot path.
- **Usability sessions** with a QA investigator on a real recall.

## Rollout policy

The classic view remains the default.  Operators see a new
**Advanced** tab next to Lineage / Tree / Network / Blast-radius.  We
do not gate this behind a feature flag because:

- The classic view is unchanged and is still default — no regression
  surface.
- The new view is built on stable, well-supported libraries
  (`@xyflow/react@12`, `elkjs@0.9`).
- A flag would actually slow adoption: power users find it, give
  feedback, drive the Phase-2 priorities.

If usage analytics later show the advanced view dominates, switch the
default in a follow-up PR.  Until then, both ship side by side.

## Dependencies added

- `@xyflow/react@^12.3.5` (MIT)
- `elkjs@^0.9.3` (EPL-2.0)

Both are installed at `libs/shared-reporting` so trace2 picks them up
transitively via its `@connectio/shared-reporting` workspace dep.
Consumers must add `import '@xyflow/react/dist/style.css'` somewhere at
their app entry — the trace2 pages do this inline next to the import.
A future cleanup can hoist the CSS import into the AppShell.

## Tests

| File | Tests | What it covers |
|---|---|---|
| `graphTransformers.test.ts` | 11 | Edge direction, dedup, depth cap, direction filter, link-type edge-id, self-transfer drop |
| `viewState.test.ts` | 5 | URL parse defaults, enum rejection, depth clamp, round-trip, selectedId null behaviour |
| `AdvancedLineageGraph.test.tsx` | 4 | Smoke mount, layout hint, no spurious callback, empty data |

Total: **20 new tests, all passing**.
The classic `LineageGraph.test.tsx` is unchanged and still passes.
