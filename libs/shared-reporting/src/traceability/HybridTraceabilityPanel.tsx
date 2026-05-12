/**
 * Side-by-side comparison shell for the classic and advanced lineage views.
 *
 * Rather than reach into trace2's `LineageGraph` directly (which would
 * create a circular dependency from `shared-reporting` back to an app), we
 * accept the classic view as a render prop.  Consumers pass:
 *
 *     <HybridTraceabilityPanel
 *       data={lineageData}
 *       classic={<LineageGraph focal={focal} upstream={…} downstream={…} />}
 *       selectedId={…}
 *       onNodeClick={…}
 *     />
 *
 * This keeps shared-reporting agnostic to app-specific components and lets
 * other apps (e.g. envmon, if it ever needs lineage) reuse the same shell.
 *
 * What we deliberately do NOT do yet
 * ---------------------------------
 * - Resizable split-pane.  The simple 50/50 flex layout is enough to prove
 *   the pattern; a real drag-to-resize will come with usability testing.
 * - Synchronised pan/zoom across the two views.  ELK and the classic
 *   layout use different coordinate spaces, so sync requires a per-view
 *   adapter.  Tracked in `docs/trace2-advanced-visualisation.md`.
 */
import type { ReactNode } from 'react'

import { AdvancedLineageGraph, type AdvancedLineageGraphProps } from './AdvancedLineageGraph'
import type { TraceViewMode } from './viewState'

export interface HybridTraceabilityPanelProps
  extends Omit<AdvancedLineageGraphProps, 'height'> {
  /** Which sub-view to render. */
  view: TraceViewMode
  /** The classic SVG `LineageGraph` rendered by the consumer app. */
  classic: ReactNode
  /** Optional fixed height for each panel.  Default 600. */
  height?: number | string
}

/** Render the requested view.  Unknown / not-yet-implemented views show a notice. */
export function HybridTraceabilityPanel({
  view,
  classic,
  height = 600,
  ...advancedProps
}: HybridTraceabilityPanelProps) {
  if (view === 'classic') {
    return <div style={{ height, width: '100%' }}>{classic}</div>
  }

  if (view === 'advanced') {
    return <AdvancedLineageGraph {...advancedProps} height={height} />
  }

  if (view === 'side-by-side') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          height,
        }}
      >
        <PanelTitleBox title="Classic">{classic}</PanelTitleBox>
        <PanelTitleBox title="Advanced">
          <AdvancedLineageGraph {...advancedProps} height="100%" />
        </PanelTitleBox>
      </div>
    )
  }

  // 'sankey' and 'table' are placeholders for later phases; surface a
  // friendly message rather than crash.
  return (
    <div
      style={{
        height,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-surface, #f8fafc)',
        border: '1px dashed var(--line, #e3e7ec)',
        borderRadius: 6,
        color: 'var(--ink-3, #6b7280)',
        fontFamily: 'var(--font-sans, system-ui)',
        fontSize: 13,
      }}
      data-testid="hybrid-panel-placeholder"
    >
      {placeholderMessage(view)}
    </div>
  )
}

function PanelTitleBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--line, #e3e7ec)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          background: 'var(--bg-surface-2, #f1f5f9)',
          borderBottom: '1px solid var(--line, #e3e7ec)',
          fontFamily: 'var(--font-sans, system-ui)',
          fontSize: 11.5,
          letterSpacing: '0.04em',
          color: 'var(--ink-3, #6b7280)',
        }}
      >
        {title.toUpperCase()}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  )
}

function placeholderMessage(view: TraceViewMode): string {
  switch (view) {
    case 'sankey':
      return 'Sankey view ships in Phase 2 — requires backend aggregate fields.'
    case 'table':
      return 'Table view ships in Phase 2 — paired with the lineage CSV export.'
    default:
      return `Unknown view: ${view}`
  }
}
