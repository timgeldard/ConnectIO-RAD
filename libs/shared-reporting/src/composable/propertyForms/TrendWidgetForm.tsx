import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { PropertyFormProps } from './types'
import type { TrendChartWidgetProps } from '../../widgets/widgetProps'
import { trendChartWidgetPropsSchema } from '../../widgets/widgetProps'
import type { QueryRegistry } from '../../data/queryRegistry'
import type { WidgetDataBinding, MappingValue } from '../../data/types'
import { DataBindingSection } from './DataBindingSection'

interface TrendWidgetFormProps extends PropertyFormProps<TrendChartWidgetProps> {
  data?: WidgetDataBinding | null
  onDataChange: (data: WidgetDataBinding | null) => void
  queryRegistry?: QueryRegistry
  dashboardParams?: Record<string, unknown>
}

export function TrendWidgetForm({
  props,
  onChange,
  data,
  onDataChange,
  queryRegistry = {},
  dashboardParams = {},
}: TrendWidgetFormProps) {
  const [activeTab, setActiveTab] = useState<'static' | 'data'>(data ? 'data' : 'static')

  const handleChange = (field: keyof TrendChartWidgetProps, value: any) => {
    const newProps = { ...props, [field]: value === '' ? undefined : value }
    const result = trendChartWidgetPropsSchema.safeParse(newProps)
    if (result.success) {
      onChange({ [field]: result.data[field as keyof typeof result.data] } as any)
    }
  }

  const handleMappingChange = (propKey: string, mappingValue: MappingValue) => {
    if (!data) return
    onDataChange({
      ...data,
      mapping: { ...(data.mapping ?? {}), [propKey]: mappingValue },
    })
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
            <textarea
              value={props.description ?? ''}
              onChange={(e) => handleChange('description', e.target.value)}
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            />
          </label>

          <label style={labelStyle}>
            <span>Value Label</span>
            <input
              type="text"
              value={props.valueLabel ?? ''}
              onChange={(e) => handleChange('valueLabel', e.target.value)}
              style={inputStyle}
              placeholder="e.g. OEE %"
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
        <div style={sectionStyle}>
          <DataBindingSection
            widgetType="trend"
            data={data}
            onDataChange={onDataChange}
            queryRegistry={queryRegistry}
            dashboardParams={dashboardParams}
            mappingFields={['points']}
            defaultMappingTransforms={{ points: 'timeseriesPoints' }}
          />
          
          {data && (
            <div style={advancedMappingStyle}>
              <div style={subheadingStyle}>Trend Points Configuration</div>
              <label style={labelStyle}>
                <span>Label Field (in array)</span>
                <input
                  type="text"
                  value={(data.mapping?.points as any)?.config?.labelKey ?? 'label'}
                  onChange={(e) => handleMappingChange('points', {
                    path: (data.mapping?.points as any)?.path ?? '',
                    transform: 'timeseriesPoints',
                    config: { ...((data.mapping?.points as any)?.config ?? {}), labelKey: e.target.value }
                  })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span>Value Field (in array)</span>
                <input
                  type="text"
                  value={(data.mapping?.points as any)?.config?.valueKey ?? 'value'}
                  onChange={(e) => handleMappingChange('points', {
                    path: (data.mapping?.points as any)?.path ?? '',
                    transform: 'timeseriesPoints',
                    config: { ...((data.mapping?.points as any)?.config ?? {}), valueKey: e.target.value }
                  })}
                  style={inputStyle}
                />
              </label>
            </div>
          )}
        </div>
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

const subheadingStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  color: 'var(--text-4)',
  marginTop: 8,
  borderBottom: '1px solid var(--border-subtle)',
  paddingBottom: 4,
}

const advancedMappingStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 8,
  background: 'var(--surface-sunken)',
  borderRadius: 4,
}
