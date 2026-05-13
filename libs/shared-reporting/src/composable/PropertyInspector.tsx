import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { ComposableWidget } from './types'
import { useDashboardEditStore } from './store'
import { KpiWidgetForm } from './propertyForms/KpiWidgetForm'
import { TrendWidgetForm } from './propertyForms/TrendWidgetForm'
import { BarWidgetForm } from './propertyForms/BarWidgetForm'
import { ParetoWidgetForm } from './propertyForms/ParetoWidgetForm'
import { TableWidgetForm } from './propertyForms/TableWidgetForm'
import { SpcWidgetForm } from './propertyForms/SpcWidgetForm'
import type { QueryRegistry } from '../data/queryRegistry'
import type { WidgetDataBinding } from '../data/types'
import { widgetPropsSchemaRegistry } from '../widgets/widgetProps'
import type { 
  KpiWidgetProps, 
  TrendChartWidgetProps, 
  BarChartWidgetProps, 
  ParetoChartWidgetProps, 
  SpcControlChartWidgetProps, 
  DrillDownTableWidgetProps 
} from '../widgets/widgetProps'

/** Props for the PropertyInspector component. */
export interface PropertyInspectorProps {
  /** The widget instance to inspect and edit. */
  widget: ComposableWidget
  /** Optional registry to resolve data binding queries. */
  queryRegistry?: QueryRegistry
  /** Optional dashboard-level parameters for data binding. */
  dashboardParams?: Record<string, unknown>
}

/**
 * Sidebar inspector for editing widget properties and data bindings.
 * 
 * Supports specialized forms for core widget types and an advanced JSON editor
 * for all types. Updates the global DashboardEditStore on change.
 * 
 * @param props - Component properties
 * @returns React element
 */
export function PropertyInspector({
  widget,
  queryRegistry,
  dashboardParams,
}: PropertyInspectorProps) {
  const { updateWidgetTitle, updateWidgetProps, updateWidgetData } = useDashboardEditStore()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handlePropsChange = (updates: Partial<Record<string, unknown>>) => {
    updateWidgetProps(widget.id, updates)
  }

  const handleDataChange = (data: WidgetDataBinding | null) => {
    updateWidgetData(widget.id, data)
  }

  const renderTypedForm = () => {
    const commonProps = {
      widgetId: widget.id,
      data: widget.data as WidgetDataBinding | null,
      onDataChange: handleDataChange,
      queryRegistry,
      dashboardParams,
    }

    // Narrowing types to avoid 'as any' where possible.
    // While ComposableWidget.props is Record<string, unknown> in the schema,
    // we cast it here to the specific widget prop type for each form.
    switch (widget.type) {
      case 'kpi':
        return (
          <KpiWidgetForm 
            props={widget.props as KpiWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      case 'trend':
        return (
          <TrendWidgetForm 
            props={widget.props as TrendChartWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      case 'bar':
        return (
          <BarWidgetForm 
            props={widget.props as BarChartWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      case 'pareto':
        return (
          <ParetoWidgetForm 
            props={widget.props as ParetoChartWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      case 'spc-control':
        return (
          <SpcWidgetForm 
            props={widget.props as SpcControlChartWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      case 'drill-down-table':
        return (
          <TableWidgetForm 
            props={widget.props as DrillDownTableWidgetProps} 
            onChange={(p) => handlePropsChange(p as any)} 
            {...commonProps} 
          />
        )
      default:
        return (
          <div style={unsupportedStyle}>
            Visual editor for <code>{widget.type}</code> coming soon. Use Advanced mode below.
          </div>
        )
    }
  }

  return (
    <div style={inspectorBodyStyle}>
      {/* Basic Info */}
      <label style={propLabelStyle}>
        <span>Title</span>
        <input
          type="text"
          value={widget.title ?? ''}
          onChange={(e) => updateWidgetTitle(widget.id, e.target.value)}
          style={propInputStyle}
          placeholder={widget.type}
          aria-label="Widget title"
        />
      </label>

      <div style={typeInfoStyle}>
        <span style={typeLabelStyle}>Type</span>
        <code style={propCodeStyle}>{widget.type}</code>
      </div>

      <hr style={dividerStyle} />

      {/* Typed Form */}
      <div style={formSectionStyle}>
        {renderTypedForm()}
      </div>

      <hr style={dividerStyle} />

      {/* Advanced JSON Editor */}
      <div style={advancedSectionStyle}>
        <button
          style={advancedToggleStyle}
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? '▼ Hide Advanced' : '▶ Show Advanced (JSON)'}
        </button>

        {showAdvanced && (
          <div style={jsonEditorContainerStyle}>
            <textarea
              style={propsTextareaStyle(!!jsonError)}
              value={JSON.stringify(widget.props, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  
                  // Validate against schema if we have one for this type
                  const schema = (widgetPropsSchemaRegistry as any)[widget.type]
                  if (schema) {
                    const result = schema.safeParse(parsed)
                    if (!result.success) {
                      setJsonError(result.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', '))
                      return
                    }
                  }

                  updateWidgetProps(widget.id, parsed)
                  setJsonError(null)
                } catch (err) {
                  setJsonError((err as Error).message)
                }
              }}
              aria-label="Widget props JSON"
              spellCheck={false}
            />
            {jsonError && <div style={jsonErrorStyle}>{jsonError}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inspectorBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  paddingTop: 8,
}

const propLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: 'var(--text-3)',
}

const propInputStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  color: 'var(--text-1)',
  padding: '5px 8px',
  borderRadius: 4,
  fontSize: 12,
}

const typeInfoStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const typeLabelStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--text-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const propCodeStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
  background: 'var(--surface-2)',
  padding: '2px 6px',
  borderRadius: 3,
}

const dividerStyle: CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  margin: 0,
}

const formSectionStyle: CSSProperties = {
  minHeight: 100,
}

const unsupportedStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-4)',
  fontStyle: 'italic',
  lineHeight: 1.4,
}

const advancedSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const advancedToggleStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-4)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  cursor: 'pointer',
  textAlign: 'left',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
}

const jsonEditorContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const propsTextareaStyle = (hasError: boolean): CSSProperties => ({
  width: '100%',
  minHeight: 120,
  background: 'var(--surface-2)',
  border: `1px solid ${hasError ? 'var(--status-risk)' : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
  color: 'var(--text-1)',
  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
  fontSize: 11,
  padding: '6px',
  borderRadius: 4,
  resize: 'vertical',
  boxSizing: 'border-box',
})

const jsonErrorStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--status-risk)',
  marginTop: 2,
}
