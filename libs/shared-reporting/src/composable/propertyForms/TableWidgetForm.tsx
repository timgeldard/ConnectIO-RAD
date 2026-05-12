import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { PropertyFormProps } from './types'
import type { DrilldownTableWidgetProps } from '../../widgets/widgetProps'
import { drilldownTableWidgetPropsSchema } from '../../widgets/widgetProps'
import type { QueryRegistry } from '../../data/queryRegistry'
import type { WidgetDataBinding } from '../../data/types'
import { DataBindingSection } from './DataBindingSection'

interface TableWidgetFormProps extends PropertyFormProps<DrilldownTableWidgetProps> {
  data?: WidgetDataBinding | null
  onDataChange: (data: WidgetDataBinding | null) => void
  queryRegistry?: QueryRegistry
  dashboardParams?: Record<string, unknown>
}

export function TableWidgetForm({
  props,
  onChange,
  data,
  onDataChange,
  queryRegistry = {},
  dashboardParams = {},
}: TableWidgetFormProps) {
  const [activeTab, setActiveTab] = useState<'static' | 'data'>(data ? 'data' : 'static')

  const handleChange = (field: keyof DrilldownTableWidgetProps, value: any) => {
    const newProps = { ...props, [field]: value === '' ? undefined : value }
    const result = drilldownTableWidgetPropsSchema.safeParse(newProps)
    if (result.success) {
      onChange({ [field]: result.data[field as keyof typeof result.data] } as any)
    }
  }

  return (
    <div style={formContainerStyle}>
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
            <span>Title</span>
            <input
              type="text"
              value={props.title ?? ''}
              onChange={(e) => handleChange('title', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Description</span>
            <input
              type="text"
              value={props.description ?? ''}
              onChange={(e) => handleChange('description', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Height</span>
            <input
              type="number"
              value={props.height ?? ''}
              onChange={(e) => handleChange('height', e.target.value === '' ? undefined : Number(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
      ) : (
        <DataBindingSection
          widgetType="table"
          data={data}
          onDataChange={onDataChange}
          queryRegistry={queryRegistry}
          dashboardParams={dashboardParams}
          mappingFields={['rows']}
          defaultMappingTransforms={{ rows: 'tableRows' }}
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
