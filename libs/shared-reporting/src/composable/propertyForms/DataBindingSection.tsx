import type { CSSProperties } from 'react'
import type { QueryRegistry, QueryParamBinding } from '../../data/queryRegistry'
import type { WidgetDataBinding, MappingValue, MappingTransform } from '../../data/types'

interface DataBindingSectionProps {
  widgetType: string
  data?: WidgetDataBinding | null
  onDataChange: (data: WidgetDataBinding | null) => void
  queryRegistry: QueryRegistry
  dashboardParams: Record<string, unknown>
  mappingFields: string[]
  defaultMappingTransforms?: Record<string, MappingTransform>
}

export function DataBindingSection({
  widgetType,
  data,
  onDataChange,
  queryRegistry,
  dashboardParams,
  mappingFields,
  defaultMappingTransforms = {},
}: DataBindingSectionProps) {
  const handleQueryChange = (queryKey: string) => {
    if (!queryKey) {
      onDataChange(null)
      return
    }
    const entry = queryRegistry[queryKey]
    onDataChange({
      queryKey,
      params: entry?.params.reduce((acc, p) => ({ ...acc, [p.key]: { value: p.defaultValue } }), {}),
      mapping: {},
    })
  }

  const handleParamBindingChange = (paramKey: string, binding: QueryParamBinding) => {
    if (!data) return
    onDataChange({
      ...data,
      params: { ...(data.params ?? {}), [paramKey]: binding },
    })
  }

  const handleMappingChange = (propKey: string, mappingValue: MappingValue) => {
    if (!data) return
    onDataChange({
      ...data,
      mapping: { ...(data.mapping ?? {}), [propKey]: mappingValue },
    })
  }

  const compatibleQueries = Object.values(queryRegistry).filter(q => q.compatibleWidgets.includes(widgetType))

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>
        <span>Query</span>
        <select
          value={data?.queryKey ?? ''}
          onChange={(e) => handleQueryChange(e.target.value)}
          style={inputStyle}
          aria-label="Query"
        >
          <option value="">(None)</option>
          {compatibleQueries.map(q => (
            <option key={q.key} value={q.key}>{q.label}</option>
          ))}
        </select>
      </label>

      {data && queryRegistry[data.queryKey] && (
        <>
          <div style={subheadingStyle}>Parameters</div>
          {queryRegistry[data.queryKey].params.map(p => {
            const binding = data.params?.[p.key];
            const isDashboard = binding && 'dashboardParam' in (binding as any);
            
            return (
              <div key={p.key} style={paramRowStyle}>
                <span style={paramLabelStyle}>{p.label}</span>
                <div style={paramBindingStyle}>
                  <select
                    value={isDashboard ? 'dashboard' : 'static'}
                    onChange={(e) => {
                      const mode = e.target.value;
                      handleParamBindingChange(p.key, mode === 'dashboard' 
                        ? { dashboardParam: Object.keys(dashboardParams)[0] || '' }
                        : { value: p.defaultValue }
                      );
                    }}
                    style={miniSelectStyle}
                  >
                    <option value="static">Fixed</option>
                    <option value="dashboard">From Dashboard</option>
                  </select>
                  {isDashboard ? (
                    <select
                      value={(binding as any).dashboardParam}
                      onChange={(e) => handleParamBindingChange(p.key, { dashboardParam: e.target.value })}
                      style={inputStyle}
                    >
                      {Object.keys(dashboardParams).map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={(binding as any)?.value ?? ''}
                      onChange={(e) => handleParamBindingChange(p.key, { value: e.target.value })}
                      style={inputStyle}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <div style={subheadingStyle}>Mapping</div>
          {mappingFields.map(propKey => {
            const currentMapping = data.mapping?.[propKey];
            const currentPath = typeof currentMapping === 'string' ? currentMapping : currentMapping?.path ?? '';
            const currentTransform = typeof currentMapping === 'string' ? undefined : currentMapping?.transform;

            return (
              <div key={propKey} style={mappingRowStyle}>
                <label style={labelStyle}>
                  <span>{propKey}</span>
                  <select
                    value={currentPath}
                    onChange={(e) => {
                      const path = e.target.value;
                      const defaultTransform = defaultMappingTransforms[propKey];
                      if (!path) {
                        handleMappingChange(propKey, '');
                      } else {
                        handleMappingChange(propKey, (currentTransform || defaultTransform) 
                          ? { path, transform: currentTransform || defaultTransform } 
                          : path);
                      }
                    }}
                    style={inputStyle}
                    aria-label={propKey}
                  >
                    <option value="">(Manual)</option>
                    {queryRegistry[data.queryKey].fields.map(f => (
                      <option key={f.path} value={f.path}>{f.label}</option>
                    ))}
                  </select>
                </label>
                {/* Simplified transform selector if needed - for now justidentity for strings/paths */}
              </div>
            );
          })}
        </>
      )}
    </div>
  )
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const subheadingStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  color: 'var(--text-4)',
  marginTop: 8,
  borderBottom: '1px solid var(--border-subtle)',
  paddingBottom: 4,
}

const paramRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const paramLabelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-2)',
}

const paramBindingStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
}

const miniSelectStyle: CSSProperties = {
  fontSize: 10,
  padding: '2px 4px',
  background: 'var(--surface-3)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-1)',
  borderRadius: 4,
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

const mappingRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
