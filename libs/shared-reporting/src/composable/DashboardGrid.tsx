/**
 * DashboardGrid — responsive drag-and-drop resizable widget grid.
 *
 * Wraps `react-grid-layout` with Kerry design system styling. In view mode the
 * grid is static (no drag/resize). In edit mode each widget cell gets a drag
 * handle and a remove button.
 *
 * The CSS import for react-grid-layout must be added by the consuming app:
 * ```
 * import 'react-grid-layout/css/styles.css'
 * import 'react-resizable/css/styles.css'
 * ```
 */
import type { CSSProperties, ReactNode } from 'react'
import { useCallback } from 'react'
import ReactGridLayout, { type Layout } from 'react-grid-layout'
import type { ComposableWidget, DashboardMode } from './types'
import { useDashboardEditStore } from './store'
import { BoundWidgetRenderer } from './BoundWidgetRenderer'
import type { QueryRegistry } from '../data/queryRegistry'

interface DashboardGridProps {
  /** Widgets to render. In view mode all widgets are rendered read-only. */
  widgets: ComposableWidget[]
  /** Total number of columns (should match `ComposableDashboardConfig.columns`). */
  columns?: number
  /** Height in pixels of a single grid row. */
  rowHeight?: number
  /** Current interaction mode. */
  mode: DashboardMode
  /**
   * Render prop for widget content. Receives the widget config and must return
   * a ReactNode. Unknown `type` values should render a fallback placeholder.
   */
  renderWidget: (widget: ComposableWidget) => ReactNode
  /** Called when the grid width changes (e.g. window resize). */
  width?: number
  /** Registry of available queries for live data binding. */
  queryRegistry?: QueryRegistry
  /** Values for parameters used in data binding queries. */
  dashboardParams?: Record<string, unknown>
}

/** Minimum pixel width per column used to calculate grid container width. */
const MIN_COL_PX = 80

/**
 * Renders a composable dashboard grid using react-grid-layout.
 *
 * Drag and resize are disabled in view mode. In edit mode the layout changes
 * are committed to the Zustand store via `updateLayouts`.
 */
export function DashboardGrid({
  widgets,
  columns = 12,
  rowHeight = 80,
  mode,
  renderWidget,
  width = 1200,
  queryRegistry,
  dashboardParams,
}: DashboardGridProps) {
  const updateLayouts = useDashboardEditStore((s) => s.updateLayouts)
  const removeWidget = useDashboardEditStore((s) => s.removeWidget)
  const selectWidget = useDashboardEditStore((s) => s.selectWidget)
  const selectedWidgetId = useDashboardEditStore((s) => s.selectedWidgetId)

  const isEdit = mode === 'edit'

  const layout: Layout[] = widgets.map((w) => ({
    i: w.id,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: w.layout.minW,
    minH: w.layout.minH,
    static: !isEdit,
  }))

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!isEdit) return
      updateLayouts(
        newLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
      )
    },
    [isEdit, updateLayouts],
  )

  return (
    <ReactGridLayout
      className="composable-dashboard-grid"
      layout={layout}
      cols={columns}
      rowHeight={rowHeight}
      width={width}
      isDraggable={isEdit}
      isResizable={isEdit}
      draggableHandle=".grid-cell__drag-handle"
      onLayoutChange={handleLayoutChange}
      margin={[12, 12]}
      containerPadding={[0, 0]}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          style={cellStyle(widget.id === selectedWidgetId && isEdit)}
          onClick={() => isEdit && selectWidget(widget.id)}
          data-widget-id={widget.id}
        >
          {isEdit && (
            <div style={cellHeaderStyle}>
              <span
                className="grid-cell__drag-handle"
                title="Drag to reposition"
                style={dragHandleStyle}
                aria-label="Drag widget"
              >
                ⠿
              </span>
              <span style={widgetTitleStyle}>{widget.title ?? widget.type}</span>
              <button
                style={removeButtonStyle}
                onClick={(e) => { e.stopPropagation(); removeWidget(widget.id) }}
                title="Remove widget"
                aria-label={`Remove ${widget.title ?? widget.type}`}
              >
                ✕
              </button>
            </div>
          )}
          <div style={cellBodyStyle(isEdit)}>
            <BoundWidgetRenderer
              widget={widget}
              queryRegistry={queryRegistry}
              dashboardParams={dashboardParams}
              renderWidget={renderWidget}
            />
          </div>
        </div>
      ))}
    </ReactGridLayout>
  )
}

// ── Inline styles (Kerry design system tokens) ───────────────────────────────

function cellStyle(isSelected: boolean): CSSProperties {
  return {
    background: 'var(--surface-1)',
    border: isSelected
      ? '2px solid var(--status-info)'
      : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
  }
}

const cellHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  fontSize: 12,
  color: 'var(--text-3)',
  userSelect: 'none',
}

const dragHandleStyle: CSSProperties = {
  cursor: 'grab',
  fontSize: 14,
  lineHeight: 1,
  color: 'var(--text-4)',
}

const widgetTitleStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const removeButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-4)',
  fontSize: 12,
  padding: '2px 4px',
  lineHeight: 1,
}

function cellBodyStyle(hasHeader: boolean): CSSProperties {
  return {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    paddingTop: hasHeader ? 4 : 8,
  }
}
