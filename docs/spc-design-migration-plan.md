# SPC Frontend Design Migration Plan

**Date:** 2026-04-23  
**Design source:** `/tmp/spc-design/spc/` (unzipped from `SPC-handoff.zip`)  
**Status:** PENDING scope decision (see Section 1)

---

## 0. What This Plan Covers

The Kerry design handoff defines a new visual language for the SPC app:
- Kerry Design System tokens (CSS custom properties)
- New shell: Sidebar (236px), Topbar, ScopeBar (combined pill filter)
- New page layouts: Overview hero, Charts 2-col, Scorecard table, Flow SVG

**The data layer is entirely untouched.** All hooks, API clients, web worker, calculation engine, React Query, URL sync, and type definitions remain as-is. Visual components are rewired to existing hooks — design mock values are not copied.

---

## 1. Scope Options — DECISION REQUIRED

Three migration approaches. **Choose one before any code is written.**

### Option A — Full rewrite, remove Carbon DS
Remove `@carbon/react`, `@carbon/styles`, `@carbon/icons-react`, `sass` from `package.json`. Rewrite every visual component using Kerry tokens + inline styles. Replace Carbon icons with the `<Icon>` inline SVG system from the handoff.

- Aligns fully with `ai-context/rules/frontend_rules.md` (inline styles + CSS variables, no heavy UI libraries)
- Pixel-perfect match to the design handoff
- ~60+ files touched, all Carbon imports eliminated
- Estimated effort: Large (several sessions)
- Risk: Tests referencing Carbon components need updating

### Option B — Kerry shell + pages, keep Carbon where it doesn't fight (hybrid)
Rewrite the shell (Sidebar, Topbar, ScopeBar), Overview, Scorecard, and Flow pages from scratch using Kerry tokens. Keep Carbon only for the modal (`PointExclusionModal.tsx`) and any deeply Carbon-coupled sub-components not visible in the primary layout.

- Achieves the 90%+ visible impact with ~40% less work
- Carbon stays in `package.json` but is used in far fewer places
- The main views and shell match the design; internals of modal are "good enough"
- Estimated effort: Medium-large

### Option C — Re-skin only (token override)
Inject Kerry CSS custom properties that override Carbon's CSS variable names. Change colours, fonts, spacing via variable aliasing. No component rewrites.

- Cheapest; no structural changes
- Will NOT match the design — Carbon's component shapes (dropdowns, data tables, tiles) don't match Kerry's flat/minimal shapes
- Acceptable only if the goal is "roughly similar colours" not visual fidelity
- Estimated effort: Small

**Recommendation:** Option A. The handoff explicitly asks for pixel-perfect recreation and `frontend_rules.md` already bans Carbon DS. The Carbon removal also eliminates ~200KB of CSS from the bundle.

---

## 2. File Inventory

### 2.1 UNTOUCHED — Data Layer (all options)

| File | Role |
|---|---|
| `src/api/client.ts` | HTTP client |
| `src/api/spc.ts` | All API fetch functions |
| `src/spc/hooks/*.ts` | All React Query hooks (`useSPCFlow`, `useSPCScorecard`, `useSPCComputedAnalytics`, etc.) |
| `src/spc/calculations.ts` | Pure calculation functions |
| `src/spc/calculations.runtime.ts` | Web worker entry |
| `src/spc/workers/spcCompute.worker.ts` | Web worker |
| `src/spc/computeAnalytics.ts` | Analytics pipeline |
| `src/spc/exclusions.ts` | Exclusion logic |
| `src/spc/types.ts` | Domain types |
| `src/spc/queryKeys.ts` | React Query keys |
| `src/spc/spcConstants.ts` | Constants |
| `src/spc/SPCContext.tsx` | Context provider |
| `src/queryClient.ts` | React Query client |
| `src/spc/flow/layoutFlowGraph.ts` | Graph layout algorithm |

### 2.2 REWRITTEN — Shell and Layout (all options A/B)

| Current File | Design Component | Key Changes |
|---|---|---|
| `src/components/layout/AppShell.tsx` | `Shell` root | Kerry layout vars (`--sidebar-w`, `--header-h`, `--filter-h`), remove Carbon `Theme` |
| `src/components/layout/Sidebar.tsx` | `Sidebar` | 236px, role switcher, nav active stripe, avatar footer |
| `src/components/layout/SPCHeader.tsx` | `Topbar` | Search (⌘K), breadcrumb, notifications, dark toggle, export |
| `src/components/layout/GlobalFilterBar.tsx` | `ScopeBar` | Combined pill: Material + Plant + Characteristic + date presets |
| `src/spc/SPCFilterBar.tsx` | (absorbed into ScopeBar) | Likely deleted or gutted |
| `src/spc/SPCPageHeader.tsx` | (absorbed into Topbar) | Likely deleted |
| `src/index.css` | Token entry point | Replace Carbon import with `kerry-tokens.css` + `kerry-app.css` |

### 2.3 REWRITTEN — Pages (all options A/B)

| Current File | Design Component | Key Changes |
|---|---|---|
| `src/spc/overview/OverviewPage.tsx` | `Overview` | Hero gradient banner, 4 KPI cards with sparklines, PrioritySignals card, CapabilitySummary, GenieTease |
| `src/spc/overview/KPICard.tsx` | `KPI` component | Impact-font number, inline sparkline, tone colour |
| `src/spc/overview/RecentViolations.tsx` | Signals list in Overview | Dot/severity/batch/time rows |
| `src/spc/scorecard/ScorecardView.tsx` | `ScorecardTab` | 4 KPI cards + table container |
| `src/spc/scorecard/ScorecardTable.tsx` | Scorecard `<table>` | Plain `<table>` replacing Carbon DataTable; Status/Char/Chart/Spec/Mean/σ/Cpk/Ppk/Trend/Signals/Last columns; `CpkBar` inline progress |
| `src/spc/scorecard/VirtualizedRows.tsx` | (review) | May stay if virtualization still needed; restyle rows |
| `src/spc/charts/ControlChartsView.tsx` | `ChartsTab` | 2-col (main + 320px rail), chart type switcher, stats strip |
| `src/spc/charts/ChartCard.tsx` | Chart container | Kerry card, characteristic header |
| `src/spc/charts/SignalsPanel.tsx` | Signals rail | Signal rows with severity badges |
| `src/spc/charts/ExclusionJustificationModal.tsx` | Exclusion workflow | Justification select + textarea; may keep Carbon modal or rewrite |
| `src/spc/charts/ChartSettingsRail.tsx` | Display panels toggles | Kerry `.chip` toggle pattern |
| `src/spc/charts/ChartSummaryBar.tsx` | Stats strip (6 metrics) | Kerry inline metric row |
| `src/spc/flow/ProcessFlowView.tsx` | `FlowTab` | Replace React Flow with inline SVG `<svg viewBox="0 0 1020 420">` |
| `src/spc/flow/ProcessNode.tsx` | SVG node | Hex overlay, status stripe, Cpk chip, sparkline — all SVG |
| `src/spc/flow/NodeTooltip.tsx` | `NodeDetail` rail | Gradient header, metrics grid, upstream/downstream lists |
| `src/spc/flow/ProcessFlowLegend.tsx` | (review) | Restyle or replace |
| `src/spc/flow/ProcessFlowMiniMap.tsx` | (review) | Remove if not in design |

### 2.4 REWRITTEN — ECharts Theme

| File | Change |
|---|---|
| `src/spc/charts/echartsTheme.ts` | IBM Carbon palette → Kerry palette |

New palette (from Kerry tokens):
```typescript
color: [
  '#005776', // Valentia Slate (primary series)
  '#44CF93', // Jade
  '#289BA2', // Sage
  '#F9C20A', // Sunrise
  '#F24A00', // Sunset
  '#DFFF11', // Innovation
  '#143700', // Forest
  '#9CA3AF', // muted fallback
]
textStyle: { fontFamily: "'IBM Plex Mono', monospace", color: '#143700' }
```

### 2.5 NEW FILES

| File | Purpose |
|---|---|
| `src/styles/kerry-tokens.css` | Copy from design handoff `kerry-tokens.css` |
| `src/styles/kerry-app.css` | Copy from design handoff `kerry-app.css` + SPC additions |
| `src/components/ui/Icon.tsx` | Inline SVG icon system (50+ icons from `Icon.jsx` in handoff) |
| `src/components/ui/KPI.tsx` | Reusable KPI card component |
| `src/components/ui/CpkBar.tsx` | Progress bar + number for scorecard Cpk column |
| `src/components/ui/Sparkline.tsx` | Inline SVG mini sparkline |

### 2.6 REMOVED (Option A only)

- `src/lib/carbon-data-table.ts`
- `src/lib/carbon-feedback.ts`
- `src/lib/carbon-forms.ts`
- `src/lib/carbon-layout.ts`
- `src/lib/carbon-theme.ts`
- All `@carbon/react` and `@carbon/icons-react` imports across all files
- `package.json`: remove `@carbon/react`, `@carbon/styles`, `@carbon/icons-react`, `sass`

---

## 3. Phase Plan (Option A)

### Phase 0 — Token Foundation (1 session)
1. Add `src/styles/kerry-tokens.css` and `src/styles/kerry-app.css` (from handoff)
2. Replace `index.css` Carbon import with Kerry token imports
3. Update `echartsTheme.ts` with Kerry palette
4. Add `src/components/ui/Icon.tsx` (inline SVG icon system)
5. Build and verify app still loads (may look broken — expected)

### Phase 1 — Shell Rewrite (1 session)
1. Rewrite `AppShell.tsx` — Kerry layout grid with CSS vars
2. Rewrite `Sidebar.tsx` — 236px, role switcher, nav, avatar
3. Rewrite `SPCHeader.tsx` → Topbar (search, breadcrumb, notifications, dark toggle)
4. Rewrite `GlobalFilterBar.tsx` → ScopeBar (combined pill + date presets)
5. Delete `SPCFilterBar.tsx` and `SPCPageHeader.tsx` if absorbed
6. App should be navigable with correct chrome

### Phase 2 — Overview Page (1 session)
1. Rewrite `OverviewPage.tsx` — hero banner, 4-KPI row, PrioritySignals, CapabilitySummary, GenieTease
2. Create `KPI.tsx`, `Sparkline.tsx` shared components
3. Wire to existing `useSPCComputedAnalytics` hook — no mock data

### Phase 3 — Scorecard Tab (1 session)
1. Rewrite `ScorecardView.tsx` — 4 KPIs + table wrapper
2. Rewrite `ScorecardTable.tsx` — plain `<table>`, Kerry row styles
3. Create `CpkBar.tsx` component
4. Wire to existing `useSPCScorecard` hook
5. Preserve sort behaviour from existing `VirtualizedRows.tsx` logic

### Phase 4 — Charts Tab (1–2 sessions)
1. Rewrite `ControlChartsView.tsx` — 2-col layout, Kerry card, chart type switcher
2. Rewrite `ChartSummaryBar.tsx` — stats strip
3. Restyle `SignalsPanel.tsx` — Kerry signal rows
4. Restyle `ChartSettingsRail.tsx` — Kerry chip toggles
5. Rewrite `ExclusionJustificationModal.tsx` — Kerry modal pattern (or keep Carbon if expedient)
6. All EChart components pick up new theme automatically

### Phase 5 — Flow Tab (1–2 sessions)
1. Replace `ProcessFlowView.tsx` React Flow canvas with inline SVG approach from design
2. Rewrite `ProcessNode.tsx` as SVG `<g>` elements
3. Rewrite `NodeTooltip.tsx` → `NodeDetail` rail
4. Keep `layoutFlowGraph.ts` for node positioning — reuse x/y coordinates in SVG
5. Wire to existing `useSPCFlow` hook

### Phase 6 — Cleanup (1 session)
1. Remove Carbon package imports from all files
2. Remove `src/lib/carbon-*.ts` files
3. Remove `@carbon/*` and `sass` from `package.json`
4. Fix any TypeScript errors from removed Carbon types
5. Run test suite — update tests that reference Carbon DOM structure

---

## 4. Dark Mode

Kerry dark theme is in `kerry-app.css` as `[data-theme="dark"]` on `<html>`. The Topbar dark toggle writes `document.documentElement.dataset.theme = 'dark' | 'light'`. No additional theming work needed beyond the token swap.

---

## 5. React Flow Removal (Phase 5 detail)

The design uses pure inline SVG, not React Flow. The `@xyflow/react` package can be removed in Phase 6 after the Flow tab is rewritten. The key question is whether the existing `layoutFlowGraph.ts` outputs x/y positions usable in an SVG coordinate space — it almost certainly does, as React Flow also uses pixel coordinates. This should be confirmed before Phase 5 begins.

---

## 6. Testing Impact

Tests in `src/spc/__tests__/` that test business logic (`calculations.test.ts`, `computeAnalytics.test.ts`, `nelsonRules.test.ts`, `exclusions.test.ts`, `urlState.test.ts`) are unaffected — they test pure functions.

Tests that check DOM structure will need updating:
- `ScorecardTable.test.tsx` — Carbon DataTable queries → plain `<table>` queries
- `ExclusionJustificationModal.test.tsx` — Carbon modal queries → native queries
- `ControlChartsView.test.tsx` — Carbon layout queries → Kerry layout
- `SPCFilterBar.test.tsx` — if filter bar is replaced

---

## 7. Package Size Impact (Option A)

| Package | Bundle size | Outcome |
|---|---|---|
| `@carbon/styles` | ~450KB CSS | Removed |
| `@carbon/react` | ~180KB JS | Removed |
| `@carbon/icons-react` | ~60KB JS | Removed |
| `sass` | dev-only | Removed |
| `@xyflow/react` | ~95KB JS | Removed in Phase 5 |
| Kerry tokens | ~8KB CSS | Added |
| Icon system | ~12KB JS | Added |

Net bundle reduction: ~775KB.
