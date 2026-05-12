import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { PropertyFormProps } from './types'
import type { KpiWidgetProps } from '../../widgets/widgetProps'
import { kpiWidgetPropsSchema } from '../../widgets/widgetProps'
import type { QueryRegistry } from '../../data/queryRegistry'
import type { WidgetDataBinding } from '../../data/types'
import { DataBindingSection } from './DataBindingSection'

/** Props for the KpiWidgetForm component. */
export interface KpiWidgetFormProps extends PropertyFormProps<KpiWidgetProps> {
  /** Optional data binding configuration. */
  data?: WidgetDataBinding | null
  /** Callback triggered when the data binding configuration changes. */
  onDataChange: (data: WidgetDataBinding | null) => void
  /** Registry of available queries for binding. */
  queryRegistry?: QueryRegistry
  /** Optional dashboard-level parameters. */
  dashboardParams?: Record<string, unknown>
}

/**
 * Property form for configured KPI widgets.
 * Supports static metrics and live data binding.
 * 
 * @param props - Component properties
 * @returns React element
 */
export function KpiWidgetForm({
  props,
  onChange,
  data,
  onDataChange,
  queryRegistry = {},
  dashboardParams = {},
}: KpiWidgetFormProps) {
  const [activeTab, setActiveTab] = useState<'static' | 'data'>(data ? 'data' : 'static')

  const handleChange = (field: keyof KpiWidgetProps, value: any) => {
    const newProps = { ...props, [field]: value === '' ? undefined : value }
    
    // Validate before calling onChange
    const result = kpiWidgetPropsSchema.safeParse(newProps)
    if (result.success) {
      onChange({ [field]: result.data[field as keyof typeof result.data] } as any)
    }
  }

  return (
    <div style={formContainerStyle}>
      {/* Tab Switcher */}
      <div style={tabContainerStyle}>
        <button
          style={activeTab === 'static' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('static')}
        >
          Static
        </button>
        <button
          style={activeTab === 'data' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('data')}
        >
          Data Binding
        </button>
      </div>

      {activeTab === 'static' ? (
        <div style={sectionStyle}>
          <label style={labelStyle}>
            <span>Label</span>
            <input
              type="text"
              value={props.label ?? ''}
              onChange={(e) => handleChange('label', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Value</span>
            <input
              type="text"
              value={props.value ?? ''}
              onChange={(e) => handleChange('value', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Unit</span>
            <input
              type="text"
              value={props.unit ?? ''}
              onChange={(e) => handleChange('unit', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Tone</span>
            <select
              value={props.tone ?? 'neutral'}
              onChange={(e) => handleChange('tone', e.target.value)}
              style={inputStyle}
            >
              <option value="neutral">Neutral</option>
              <option value="ok">OK</option>
              <option value="warn">Warning</option>
              <option value="risk">Risk</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span>Delta</span>
            <input
              type="text"
              value={props.delta ?? ''}
              onChange={(e) => handleChange('delta', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Trend</span>
            <select
              value={props.trend ?? ''}
              onChange={(e) => handleChange('trend', e.target.value)}
              style={inputStyle}
            >
              <option value="">None</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span>Subtext</span>
            <input
              type="text"
              value={props.subtext ?? ''}
              onChange={(e) => handleChange('subtext', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Progress % (0-100)</span>
            <input
              type="number"
              min="0"
              max="100"
              value={props.progressBar ?? ''}
              onChange={(e) => handleChange('progressBar', e.target.value === '' ? '' : Number(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
      ) : (
        <DataBindingSection
          widgetType="kpi"
          data={data}
          onDataChange={onDataChange}
          queryRegistry={queryRegistry}
          dashboardParams={dashboardParams}
          mappingFields={['value', 'delta', 'subtext', 'progressBar']}
        />
      )}
    </div>
  )
}

const formContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const tabContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 2,
  background: 'var(--surface-sunken, rgba(0,0,0,0.1))',
  borderRadius: 4,
}

const tabStyle: CSSProperties = {
  flex: 1,
  padding: '4px 0',
  fontSize: 11,
  background: 'none',
  border: 'none',
  color: 'var(--text-3)',
  cursor: 'pointer',
  borderRadius: 3,
}

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: 'var(--surface-1)',
  color: 'var(--text-1)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: 'var(--text-3)',
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  color: 'var(--text-1)',
  padding: '5px 8px',
  borderRadius: 4,
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
}
