# trace2 advanced traceability visualisation

- **Status:** Phase 0 + Phase 1 + Phase 2 + Phase 3a (lib surface) complete; Phase 3b (trace2 Genie wiring) + Phase 4 not started
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

### Phase 1 finishing items — ✅ shipped (2026-05-12 follow-up)

- **Smart node grouping** — `buildLineageGraph` now accepts
  `groupBy: 'none' | 'plant' | 'material'`.  Compound parent nodes wrap
  same-group rows; intra-group edges collapse, cross-group edges are
  rewritten to the group ids.  ELK lays out the compound graph via the
  `INCLUDE_CHILDREN` hierarchy mode.
- **Filter controls UI** — `TraceFilterControls` exposes direction,
  per-side depth sliders, group-by selector, and link-type chips.
  Both BottomUp and TopDown render it above the advanced graph (with
  the direction segment hidden since each page is inherently one
  direction).  State is currently local to each page; `useTraceViewState`
  has been extended with `groupBy` + `enabledLinks` so wiring the URL
  sync in a follow-up is a one-line change per page.
- **Path-quantity overlay** — edges aggregate qty across parallel rows
  and carry a `weight` field in `1..6` derived from a log-scaled
  normalisation across the graph.  `AdvancedLineageGraph` translates
  weight into stroke width and shows a short qty label on each edge
  (k/M shortening for compactness).  Zero-qty edges fall back to width
  `1` — no fabricated visuals.

### Phase 2 — Sankey + table views — ✅ shipped (2026-05-12)

- **Backend `flow_qty`.**  `libs/shared-trace/src/shared_trace/dal.py`
  now emits a per-edge `flow_qty` alongside the existing per-node
  cumulative `qty` for both bottom-up and top-down lineage.  A new
  `edge_agg` CTE groups by the full (parent triple → child triple)
  tuple and `SUM(QUANTITY)`; the final SELECT left-joins it on the
  canonical parent picked by the existing `MIN()` logic.  Back-compat
  for `qty` is preserved.  `entities.yaml` documents both the
  `gold_batch_lineage.QUANTITY` source column and the derived
  `flow_qty` measure.
- **`SankeyFlowView`.**  ECharts Sankey via the shared `EChart`
  wrapper.  Honours direction / depth / link / group filters by
  delegating to `buildLineageGraph` and re-encoding its output as
  Sankey nodes + links.  Falls back gracefully when filters strip
  all edges (shows a placeholder, not an empty chart).  3 smoke
  tests.
- **`LineageTableView`.**  Sortable HTML table with focal row, side
  badges, link, `flow_qty`, `qty`, UOM.  CSV export action via a
  hidden anchor.  Honours every filter the other two views honour.
  6 unit tests.
- Frontend transform now prefers `flow_qty` for edge weight when
  present, falling back to `qty` for older payloads (4 dedicated
  back-compat tests).

### Phase 3a — Lib-side polish — ✅ shipped (2026-05-12)

- **Performance.**  `AdvancedLineageGraph` now honours React Flow's
  `onlyRenderVisibleElements` once node count exceeds a configurable
  threshold (default 150).  A small ``virtualised · N nodes`` badge
  appears in the bottom-right so QA can see the mode is active.  A
  ``Re-laying out…`` indicator appears in the top-right while ELK
  recomputes a layout after a filter change, so users know the brief
  unresponsiveness is expected.
- **PNG + SVG export.**  New `LineageExportMenu` floating button on
  both `AdvancedLineageGraph` and `SankeyFlowView`.  `Advanced` view
  captures the React Flow viewport via lazy-loaded `html-to-image`
  (PNG + SVG); `Sankey` uses ECharts' native `getDataURL` (PNG) and
  `renderToSVGString` (SVG, with a data-URL fallback).  Filenames
  follow the pattern
  `lineage-<material_id>-<batch_id>-<view>-<yyyymmddTHHMM>.<ext>`,
  sanitised against filesystem-unsafe characters.  Table view's
  CSV export landed in Phase 2.
- **High-contrast theming.**  New `LineageTheme` palette (default +
  high-contrast) plumbed via a `LineageThemeContext` so every custom
  React Flow node renderer (focal, lineage, group) reads the active
  palette without prop drilling.  Edge stroke colours, label
  contrast, MiniMap colours, and the export background all flip
  with the theme.  `SankeyFlowView` and `LineageTableView` accept
  the same `theme` prop and re-skin their containers.  High-contrast
  is tuned for plant-floor tablet screens in bright environments.
- **Genie ("Explain this transfer") dispatch surface.**  Right-click
  on any non-focal node opens a small context menu with an
  *Explain this transfer* item.  The lib emits a structured
  `LineageNodeContext` to the host-supplied `onExplainNode` callback.
  Two helper functions package that context for Genie:
  `buildExplainTransferPrompt(ctx)` (user-facing prompt string) and
  `buildExplainTransferContext(ctx)` (structured `page_context` block).
  When the host omits `onExplainNode` the right-click menu stays
  hidden — the lib stays agnostic to whichever AI assistant a host
  app wires up.

### Phase 3b — trace2 Genie wiring — not in this PR

Trace2 currently has no Genie router or drawer.  Porting POH's
`genie_assist/` backend + `genie/` frontend (drawer + hook + page
context builder + multi-space routing through the platform shell) is
roughly 1,000 LOC of mostly mechanical port work plus a deploy-time
`GENIE_SPACE_ID` env var.  Scoping that into a dedicated PR keeps the
lib changes reviewable and lets the trace2 team make their own
Genie-space ownership decisions.

When that PR lands, wiring is one prop change per page:

```tsx
const { ask } = useTrace2Genie()  // hypothetical, follow-up PR
<AdvancedLineageGraph
  …existing props…
  onExplainNode={(ctx) => ask({
    prompt: buildExplainTransferPrompt(ctx),
    pageContext: buildExplainTransferContext(ctx),
  })}
/>
```

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
| `graphTransformers.test.ts` | 22 | Edge direction, dedup, depth cap, direction filter, link-type edge-id, self-transfer drop, link filter ratchet, qty weight scaling, no-qty fallback, group-by plant/material, intra-group collapse, cross-group rewrite |
| `viewState.test.ts` | 5 | URL parse defaults, enum rejection, depth clamp, round-trip including `groupBy`+`enabledLinks`, selectedId null behaviour |
| `AdvancedLineageGraph.test.tsx` | 4 | Smoke mount, layout hint, no spurious callback, empty data |
| `TraceFilterControls.test.tsx` | 6 | Default visibility, hide-on-direction, segmented click, link-chip toggle, last-link safety net, slider numeric emit |
| `flow_qty.test.ts` | 4 | flow_qty drives weight, fall-back to qty, zero-flow → weight 1, NaN → fall-back |
| `SankeyFlowView.test.tsx` | 3 | Smoke render, empty-filter placeholder, link filter applied |
| `LineageTableView.test.tsx` | 6 | Render focal + rows, flow_qty shown, sort toggle (aria-sort), enabledLinks filter, row click forwards id, export button state |
| `exportHelpers.test.ts` | 11 | filename pattern + sanitisation + fallback, PNG data-URL → Blob, SVG string → Blob, anchor-click trigger, delayed URL revoke |
| `LineageExportMenu.test.tsx` | 6 | render-when-empty, toggle, item visibility per handler, dispatch, busy state, failure clears busy + logs |
| `geniePrompt.test.ts` | 6 | upstream / downstream phrasing, optional flow clause, fixed ask questions, deterministic JSON context, optional flow_qty |
| `theme.test.tsx` | 3 | palette uniqueness, every key populated, `data-theme` attribute |

Total: **71 tests, all passing**.
The classic `LineageGraph.test.tsx` is unchanged and still passes.
