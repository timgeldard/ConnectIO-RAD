import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { PropertyFormProps } from './types'
import type { SpcControlChartWidgetProps } from '../../widgets/widgetProps'
import { spcControlChartWidgetPropsSchema } from '../../widgets/widgetProps'
import type { QueryRegistry } from '../../data/queryRegistry'
import type { WidgetDataBinding, MappingValue } from '../../data/types'
import { DataBindingSection } from './DataBindingSection'

interface SpcWidgetFormProps extends PropertyFormProps<SpcControlChartWidgetProps> {
  data?: WidgetDataBinding | null
  onDataChange: (data: WidgetDataBinding | null) => void
  queryRegistry?: QueryRegistry
  dashboardParams?: Record<string, unknown>
}

export function SpcWidgetForm({
  props,
  onChange,
  data,
  onDataChange,
  queryRegistry = {},
  dashboardParams = {},
}: SpcWidgetFormProps) {
  const [activeTab, setActiveTab] = useState<'static' | 'data'>(data ? 'data' : 'static')

  const handleChange = (field: keyof SpcControlChartWidgetProps, value: any) => {
    const newProps = { ...props, [field]: value === '' ? undefined : value }
    const result = spcControlChartWidgetPropsSchema.safeParse(newProps)
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
            <span>Value Label</span>
            <input
              type="text"
              value={props.valueLabel ?? ''}
              onChange={(e) => handleChange('valueLabel', e.target.value)}
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

          <div style={subheadingStyle}>Fixed Limits</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <label style={labelStyle}>
              <span>LCL</span>
              <input
                type="number"
                value={props.limits?.lcl ?? ''}
                onChange={(e) => handleChange('limits', { ...props.limits, lcl: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              <span>CL</span>
              <input
                type="number"
                value={props.limits?.cl ?? ''}
                onChange={(e) => handleChange('limits', { ...props.limits, cl: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              <span>UCL</span>
              <input
                type="number"
                value={props.limits?.ucl ?? ''}
                onChange={(e) => handleChange('limits', { ...props.limits, ucl: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      ) : (
        <div style={sectionStyle}>
          <DataBindingSection
            widgetType="spc-control"
            data={data}
            onDataChange={onDataChange}
            queryRegistry={queryRegistry}
            dashboardParams={dashboardParams}
            mappingFields={['points', 'limits']}
            defaultMappingTransforms={{ points: 'spcPoints', limits: 'spcLimits' }}
          />

          {data && (
            <div style={advancedMappingStyle}>
              <div style={subheadingStyle}>SPC Configuration</div>
              <label style={labelStyle}>
                <span>Points Value Field</span>
                <input
                  type="text"
                  value={(data.mapping?.points as any)?.config?.valueKey ?? 'value'}
                  onChange={(e) => handleMappingChange('points', {
                    path: (data.mapping?.points as any)?.path ?? '',
                    transform: 'spcPoints',
                    config: { ...((data.mapping?.points as any)?.config ?? {}), valueKey: e.target.value }
                  })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span>Signal Field</span>
                <input
                  type="text"
                  value={(data.mapping?.points as any)?.config?.signalKey ?? 'signal'}
                  onChange={(e) => handleMappingChange('points', {
                    path: (data.mapping?.points as any)?.path ?? '',
                    transform: 'spcPoints',
                    config: { ...((data.mapping?.points as any)?.config ?? {}), signalKey: e.target.value }
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
