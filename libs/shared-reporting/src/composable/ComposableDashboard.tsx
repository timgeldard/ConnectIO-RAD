/**
 * ComposableDashboard — main shell that renders a dashboard in view or edit mode.
 *
 * Usage:
 * ```tsx
 * <ComposableDashboard
 *   dashboardId="abc-123"
 *   registry={myWidgetRegistry}
 *   widgetDefinitions={MY_WIDGET_DEFS}
 *   onSaved={(detail) => console.log('saved', detail)}
 * />
 * ```
 *
 * The component fetches the dashboard via TanStack Query, loads it into the
 * Zustand edit store, and delegates rendering to either `DashboardGrid` (view)
 * or `DashboardBuilder` (edit).
 *
 * CSS for the skeleton pulse animation is injected via a `<style>` tag on first
 * render. Import `react-grid-layout/css/styles.css` and
 * `react-resizable/css/styles.css` in your application entry point.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardDetail, ComposableWidget } from './types'
import { useDashboardEditStore } from './store'
import { useDashboard, useUpdateDashboard } from '../hooks/useDashboards'
import { DashboardGrid } from './DashboardGrid'
import { DashboardBuilder } from './DashboardBuilder'
import type { WidgetRegistry } from '../core/registry'

interface WidgetDefinitionMeta {
  /** Registry key that matches `ComposableWidget.type`. */
  type: string
  /** Display label shown in the edit-mode palette sidebar. */
  label: string
  /** Short description shown on hover in the palette. */
  description?: string
  /** Default layout dimensions when dropped onto the grid. */
  defaultLayout?: { w: number; h: number }
  /** Default props used to initialise the widget. */
  defaultProps?: Record<string, unknown>
}

interface ComposableDashboardProps {
  /** UUID of the dashboard to load and render. */
  dashboardId: string
  /** Widget registry mapping type keys to render components. */
  registry: WidgetRegistry
  /** Widget type definitions shown in the edit-mode palette sidebar. */
  widgetDefinitions: WidgetDefinitionMeta[]
  /** Called after a successful save with the updated dashboard detail. */
  onSaved?: (detail: DashboardDetail) => void
  /** Whether the Edit button is visible in view mode (defaults to true). */
  canEdit?: boolean
}

/**
 * Renders a composable dashboard in view or edit mode.
 *
 * Handles loading, error, and empty states. In edit mode delegates to
 * `DashboardBuilder`; in view mode delegates to `DashboardGrid`.
 */
export function ComposableDashboard({
  dashboardId,
  registry,
  widgetDefinitions,
  onSaved,
  canEdit = true,
}: ComposableDashboardProps) {
  const { data: dashboard, isPending, isError } = useDashboard(dashboardId)
  const { mutateAsync: updateDashboard } = useUpdateDashboard()

  // Scoped selectors — subscribe only to the slices this component needs.
  const loadDashboard = useDashboardEditStore((s) => s.loadDashboard)
  const setMode = useDashboardEditStore((s) => s.setMode)
  const discardEdits = useDashboardEditStore((s) => s.discardEdits)
  const mode = useDashboardEditStore((s) => s.mode)
  const editConfig = useDashboardEditStore((s) => s.editConfig)

  const containerRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(1100)

  // Load the dashboard into the store whenever the fetched data changes.
  useEffect(() => {
    if (dashboard) loadDashboard(dashboard)
  }, [dashboard, loadDashboard])

  // Track container width so the grid can fill the available area.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setGridWidth(w)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const renderWidget = useCallback(
    (widget: ComposableWidget): ReactNode => {
      const Component = registry.get(widget.type)
      if (!Component) {
        return <UnknownWidgetPlaceholder type={widget.type} />
      }
      return (
        <Component
          config={{
            id: widget.id,
            type: widget.type,
            title: widget.title,
            props: widget.props,
            layout: {},
            interactions: [],
          }}
          props={widget.props as Record<string, unknown>}
        />
      )
    },
    [registry],
  )

  const handleSave = useCallback(async () => {
    // Read latest values from the store to avoid stale closures.
    const { editConfig: cfg, dashboard: loaded } = useDashboardEditStore.getState()
    if (!cfg || !loaded) return
    try {
      const updated = await updateDashboard({
        id: loaded.id,
        title: loaded.title,
        description: loaded.description ?? undefined,
        config: cfg,
        isPublic: loaded.isPublic,
        tags: loaded.tags,
      })
      loadDashboard(updated)
      onSaved?.(updated)
    } catch (err) {
      console.error('[ComposableDashboard] save failed:', err)
    }
  }, [updateDashboard, onSaved, loadDashboard])

  const handleCancel = useCallback(() => {
    setMode('view')
    discardEdits()
  }, [setMode, discardEdits])

  if (isPending) return <DashboardSkeleton />
  if (isError || !dashboard) return <DashboardError />

  const activeConfig = mode === 'edit' ? editConfig : dashboard.config

  return (
    <div ref={containerRef} style={containerStyle}>
      {mode === 'view' && canEdit && (
        <div style={viewToolbarStyle}>
          <span style={dashboardTitleStyle}>{dashboard.title}</span>
          <button
            className="btn"
            style={editButtonStyle}
            onClick={() => setMode('edit')}
            aria-label="Enter edit mode"
          >
            Edit
          </button>
        </div>
      )}

      {mode === 'edit' ? (
        <DashboardBuilder
          widgetDefinitions={widgetDefinitions}
          renderWidget={renderWidget}
          gridWidth={Math.max(gridWidth - 2 * 220 - 24, 400)}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <div style={{ overflow: 'auto', flex: 1 }}>
          <DashboardGrid
            widgets={activeConfig?.widgets ?? []}
            columns={activeConfig?.columns ?? 12}
            rowHeight={activeConfig?.rowHeight ?? 80}
            mode="view"
            renderWidget={renderWidget}
            width={gridWidth}
          />
        </div>
      )}
    </div>
  )
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function UnknownWidgetPlaceholder({ type }: { type: string }) {
  return (
    <div style={placeholderStyle}>
      <span style={placeholderTypeStyle}>{type}</span>
      <span style={placeholderMsgStyle}>Widget type not registered</span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div style={skeletonStyle} aria-busy="true" aria-label="Loading dashboard…">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={skeletonCellStyle(i)} />
      ))}
    </div>
  )
}

function DashboardError() {
  return (
    <div style={errorStyle} role="alert">
      Failed to load dashboard. Please refresh or contact support.
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--surface-0)',
  color: 'var(--text-1)',
}

const viewToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  flexShrink: 0,
}

const dashboardTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  color: 'var(--text-1)',
}

const editButtonStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  color: 'var(--text-2)',
  padding: '5px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
}

const placeholderStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 4,
}

const placeholderTypeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
  fontSize: 12,
  color: 'var(--text-3)',
}

const placeholderMsgStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-4)',
}

const skeletonStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  padding: 12,
}

function skeletonCellStyle(i: number): CSSProperties {
  return {
    height: 120 + (i % 2) * 40,
    background: 'var(--surface-1)',
    borderRadius: 6,
    opacity: 0.6,
  }
}

const errorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--status-risk)',
  fontSize: 14,
}
