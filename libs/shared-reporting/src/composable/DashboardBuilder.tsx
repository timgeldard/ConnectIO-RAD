/**
 * DashboardBuilder — full editing shell for composable dashboards.
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────┐
 * │ DashboardToolbar (save/cancel/mode) │
 * ├──────────┬──────────────────┬───────┤
 * │ Widget   │  DashboardGrid   │ Prop  │
 * │ Palette  │  (drag & drop)   │ Insp. │
 * └──────────┴──────────────────┴───────┘
 * ```
 *
 * The builder is rendered by `ComposableDashboard` when `mode === 'edit'`.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { ComposableWidget } from './types'
import { useDashboardEditStore } from './store'
import { DashboardGrid } from './DashboardGrid'
import { PropertyInspector } from './PropertyInspector'
import type { QueryRegistry } from '../data/queryRegistry'

interface WidgetDefinition {
  /** Registry key that matches `ComposableWidget.type`. */
  type: string
  /** Display label shown in the palette. */
  label: string
  /** Optional description shown on hover. */
  description?: string
  /** Default layout dimensions when added to the grid. */
  defaultLayout?: { w: number; h: number }
  /** Default props to initialise the widget with. */
  defaultProps?: Record<string, unknown>
}

interface DashboardBuilderProps {
  /** Available widget types for the palette sidebar. */
  widgetDefinitions: WidgetDefinition[]
  /** Render prop — same contract as DashboardGrid.renderWidget. */
  renderWidget: (widget: ComposableWidget) => ReactNode
  /** Grid container width in pixels, typically from a ResizeObserver. */
  gridWidth?: number
  /** Called when the user clicks Save. Receives the current edit config JSON. */
  onSave: () => void
  /** Called when the user cancels edits. */
  onCancel: () => void
  /** Registry of available queries for live data binding. */
  queryRegistry?: QueryRegistry
  /** Values for parameters used in data binding queries. */
  dashboardParams?: Record<string, unknown>
}

/**
 * Full dashboard editing shell.
 *
 * Composes the widget palette, the DashboardGrid, and the property inspector
 * into a single column layout. The toolbar at the top handles save/cancel.
 */
export function DashboardBuilder({
  widgetDefinitions,
  renderWidget,
  gridWidth = 1100,
  onSave,
  onCancel,
  queryRegistry,
  dashboardParams,
}: DashboardBuilderProps) {
  const { editConfig, isDirty, addWidget, selectedWidgetId } = useDashboardEditStore()
  const [paletteFilter, setPaletteFilter] = useState('')

  const filteredDefs = widgetDefinitions.filter(
    (d) =>
      !paletteFilter ||
      d.label.toLowerCase().includes(paletteFilter.toLowerCase()) ||
      d.type.toLowerCase().includes(paletteFilter.toLowerCase()),
  )

  function handleAddWidget(def: WidgetDefinition) {
    const widget: ComposableWidget = {
      id: crypto.randomUUID(),
      type: def.type,
      title: def.label,
      layout: {
        x: 0,
        y: Infinity,
        w: def.defaultLayout?.w ?? 4,
        h: def.defaultLayout?.h ?? 4,
        minW: 2,
        minH: 2,
      },
      props: def.defaultProps ?? {},
    }
    addWidget(widget)
  }

  const selectedWidget = editConfig?.widgets.find((w) => w.id === selectedWidgetId) ?? null

  return (
    <div style={builderContainerStyle}>
      <DashboardToolbarStrip isDirty={isDirty} onSave={onSave} onCancel={onCancel} />
      <div style={builderBodyStyle}>
        {/* Left: widget palette */}
        <aside style={paletteStyle} aria-label="Widget palette">
          <div className="eyebrow" style={sidebarHeadingStyle}>Widgets</div>
          <input
            type="search"
            placeholder="Filter widgets…"
            value={paletteFilter}
            onChange={(e) => setPaletteFilter(e.target.value)}
            style={searchInputStyle}
            aria-label="Filter available widgets"
          />
          <ul style={paletteListStyle}>
            {filteredDefs.map((def) => (
              <li key={def.type}>
                <button
                  style={paletteItemStyle}
                  onClick={() => handleAddWidget(def)}
                  title={def.description}
                  aria-label={`Add ${def.label} widget`}
                >
                  <span style={paletteItemLabelStyle}>{def.label}</span>
                  {def.description && (
                    <span style={paletteItemDescStyle}>{def.description}</span>
                  )}
                </button>
              </li>
            ))}
            {filteredDefs.length === 0 && (
              <li style={emptyPaletteStyle}>No widgets match</li>
            )}
          </ul>
        </aside>

        {/* Centre: grid */}
        <main style={gridAreaStyle}>
          {editConfig ? (
            <DashboardGrid
              widgets={editConfig.widgets}
              columns={editConfig.columns}
              rowHeight={editConfig.rowHeight}
              mode="edit"
              renderWidget={renderWidget}
              width={gridWidth}
              queryRegistry={queryRegistry}
              dashboardParams={dashboardParams}
            />
          ) : (
            <div style={emptyGridStyle}>No dashboard loaded</div>
          )}
        </main>

        {/* Right: property inspector */}
        <aside style={inspectorStyle} aria-label="Property inspector">
          <div className="eyebrow" style={sidebarHeadingStyle}>Properties</div>
          {selectedWidget ? (
            <PropertyInspector
              widget={selectedWidget}
              queryRegistry={queryRegistry}
              dashboardParams={dashboardParams}
            />
          ) : (
            <div style={emptyInspectorStyle}>Select a widget to edit its properties.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Toolbar strip (internal — kept co-located with builder for cohesion)
// ──────────────────────────────────────────────────────────────────────────

interface DashboardToolbarStripProps {
  isDirty: boolean
  onSave: () => void
  onCancel: () => void
}

function DashboardToolbarStrip({ isDirty, onSave, onCancel }: DashboardToolbarStripProps) {
  return (
    <div style={toolbarStyle} role="toolbar" aria-label="Dashboard editor toolbar">
      <span style={toolbarTitleStyle}>Editing dashboard</span>
      <div style={toolbarActionsStyle}>
        <button
          className="btn"
          style={cancelBtnStyle}
          onClick={onCancel}
          aria-label="Cancel edits and return to view mode"
        >
          Cancel
        </button>
        <button
          className="btn"
          style={saveBtnStyle(isDirty)}
          onClick={onSave}
          disabled={!isDirty}
          aria-label="Save dashboard changes"
        >
          {isDirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const builderContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--surface-0)',
  color: 'var(--text-1)',
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  gap: 12,
  flexShrink: 0,
}

const toolbarTitleStyle: CSSProperties = {
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: 12,
  color: 'var(--text-3)',
}

const toolbarActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
}

const cancelBtnStyle: CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  color: 'var(--text-2)',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
}

const saveBtnStyle = (isDirty: boolean): CSSProperties => ({
  background: isDirty ? 'var(--status-info)' : 'var(--surface-2)',
  border: 'none',
  color: isDirty ? '#fff' : 'var(--text-4)',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: isDirty ? 'pointer' : 'default',
  fontSize: 13,
  fontWeight: 600,
  transition: 'background 0.15s',
})

const builderBodyStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}

const sidebarWidth = 220

const paletteStyle: CSSProperties = {
  width: sidebarWidth,
  flexShrink: 0,
  background: 'var(--surface-1)',
  borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 8px',
  gap: 8,
}

const inspectorStyle: CSSProperties = {
  width: sidebarWidth,
  flexShrink: 0,
  background: 'var(--surface-1)',
  borderLeft: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  overflowY: 'auto',
  padding: '12px 8px',
}

const sidebarHeadingStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--text-4)',
  letterSpacing: '0.08em',
  marginBottom: 4,
}

const searchInputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  color: 'var(--text-1)',
  padding: '5px 8px',
  borderRadius: 4,
  fontSize: 12,
  boxSizing: 'border-box',
}

const paletteListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const paletteItemStyle: CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  borderRadius: 4,
  padding: '6px 8px',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'var(--text-1)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const paletteItemLabelStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
}

const paletteItemDescStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  lineHeight: 1.3,
}

const emptyPaletteStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-4)',
  textAlign: 'center',
  padding: '12px 0',
}

const gridAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 12,
}

const emptyGridStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-4)',
  fontSize: 14,
}

const emptyInspectorStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-4)',
  paddingTop: 8,
  lineHeight: 1.5,
}
