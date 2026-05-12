import type { CSSProperties } from 'react'
import type { QueryField, QueryRegistry, QueryRegistryEntry } from '../../data/queryRegistry'
import type { WidgetDataBinding, QueryParamBinding, MappingValue, MappingTransform } from '../../data/types'

/**
 * Props for the data-binding form section shown in widget property editors.
 */
interface DataBindingSectionProps {
  /** Type of widget being configured, such as `kpi` or `trend`. */
  widgetType: string
  /** Current data-binding configuration, if the widget already has one. */
  data?: WidgetDataBinding | null
  /** Callback fired whenever the binding configuration changes. */
  onDataChange: (data: WidgetDataBinding | null) => void
  /** Available query registry entries keyed by query name. */
  queryRegistry: QueryRegistry
  /** Dashboard-level parameters available for parameter binding. */
  dashboardParams: Record<string, unknown>
  /** Widget prop keys that can be mapped from query results. */
  mappingFields: string[]
  /** Default transforms to apply for specific mapping fields. */
  defaultMappingTransforms?: Record<string, MappingTransform>
}

/**
 * Normalizes a field path for case-insensitive matching.
 *
 * @param path - The query field path to normalize.
 * @returns Lower-cased path string.
 */
function normalizePath(path: string): string {
  return path.trim().toLowerCase()
}

/**
 * Finds the first query field matching one of the preferred paths.
 *
 * Exact matches win, followed by suffix matches for nested payloads.
 *
 * @param entry - Query registry entry being inspected.
 * @param preferredPaths - Candidate field paths in priority order.
 * @param allowedTypes - Optional field types to allow.
 * @returns The best matching field, if any.
 */
function findPreferredField(
  entry: QueryRegistryEntry,
  preferredPaths: string[],
  allowedTypes?: QueryField['type'][],
): QueryField | undefined {
  const normalizedCandidates = preferredPaths.map(normalizePath)
  const matchesType = (field: QueryField) => !allowedTypes || allowedTypes.includes(field.type)

  for (const candidate of normalizedCandidates) {
    const exact = entry.fields.find((field) => normalizePath(field.path) === candidate && matchesType(field))
    if (exact) return exact

    const nested = entry.fields.find((field) => normalizePath(field.path).endsWith(`.${candidate}`) && matchesType(field))
    if (nested) return nested
  }

  return undefined
}

/**
 * Finds the first field with the requested semantic hint.
 *
 * @param entry - Query registry entry being inspected.
 * @param semantic - Semantic hint to search for.
 * @param allowedTypes - Optional field types to allow.
 * @returns Matching field, if one exists.
 */
function findSemanticField(
  entry: QueryRegistryEntry,
  semantic: QueryField['semantic'],
  allowedTypes?: QueryField['type'][],
): QueryField | undefined {
  return entry.fields.find((field) => field.semantic === semantic && (!allowedTypes || allowedTypes.includes(field.type)))
}

/**
 * Creates a mapping value, preserving transform metadata when needed.
 *
 * @param path - Query response field path.
 * @param transform - Optional transform to apply.
 * @returns A mapping value suitable for widget data binding.
 */
function buildMappingValue(path: string, transform?: MappingTransform): MappingValue {
  return transform ? { path, transform } : path
}

/**
 * Builds a useful starter mapping for the selected widget/query combination.
 *
 * The mapping is intentionally conservative: it prefers canonical payload keys
 * first and only falls back to broad numeric/semantic matches when the query
 * does not expose the ideal field names.
 *
 * @param widgetType - Current widget type.
 * @param entry - Selected query definition.
 * @param mappingFields - Widget prop keys that support mapping.
 * @param defaultMappingTransforms - Widget-level default transforms.
 * @returns Suggested mapping configuration.
 */
function buildDefaultMapping(
  widgetType: string,
  entry: QueryRegistryEntry,
  mappingFields: string[],
  defaultMappingTransforms: Record<string, MappingTransform>,
): Record<string, MappingValue> {
  const mapping: Record<string, MappingValue> = {}
  const supports = (propKey: string) => mappingFields.includes(propKey)
  const assign = (propKey: string, field: QueryField | undefined, transform?: MappingTransform) => {
    if (!supports(propKey) || !field) return
    mapping[propKey] = buildMappingValue(field.path, transform ?? defaultMappingTransforms[propKey])
  }

  if (widgetType === 'kpi') {
    const valueField =
      findPreferredField(entry, ['value', 'avg_oee_pct', 'schedule_adherence_pct', 'failure_count', 'open_qty', 'blocked_batch_count'], ['number']) ??
      findSemanticField(entry, 'percentage', ['number']) ??
      entry.fields.find((field) => field.type === 'number')
    const deltaField = findPreferredField(entry, ['delta'], ['string'])
    const subtextField =
      findPreferredField(entry, ['subtext', 'summary', 'status', 'quality_status', 'batch_status', 'usage_decision'], ['string']) ??
      findSemanticField(entry, 'status', ['string'])
    const progressField =
      findPreferredField(entry, ['progressBar', 'schedule_adherence_pct', 'avg_oee_pct', 'yield_pct', 'failure_rate_pct', 'mass_balance_variance_pct'], ['number']) ??
      findSemanticField(entry, 'percentage', ['number'])

    assign('value', valueField)
    assign('delta', deltaField)
    assign('subtext', subtextField)
    assign('progressBar', progressField)
    return mapping
  }

  if (widgetType === 'trend') {
    assign(
      'points',
      findPreferredField(entry, ['points', 'daily_history', 'history', 'trend'], ['array']) ??
        findSemanticField(entry, 'timeseries', ['array']),
      'timeseriesPoints',
    )
    return mapping
  }

  if (widgetType === 'bar') {
    assign('categories', findPreferredField(entry, ['categories'], ['array']))
    assign('series', findPreferredField(entry, ['series'], ['array']), 'barSeries')
    return mapping
  }

  if (widgetType === 'pareto') {
    assign('items', findPreferredField(entry, ['items', 'rows'], ['array']), 'paretoItems')
    return mapping
  }

  if (widgetType === 'drill-down-table') {
    assign('rows', findPreferredField(entry, ['rows'], ['array']), 'tableRows')
    return mapping
  }

  if (widgetType === 'spc-control') {
    assign('points', findPreferredField(entry, ['points'], ['array']), 'spcPoints')
    assign('limits', findPreferredField(entry, ['summary.limits', 'limits'], ['object']), 'spcLimits')
    return mapping
  }

  return mapping
}

/**
 * Renders query selection, parameter binding, and field mapping controls for a widget.
 *
 * @param props - Component properties controlling the active widget binding state.
 * @param props.widgetType - Widget type being configured.
 * @param props.data - Existing widget binding configuration, if any.
 * @param props.onDataChange - Callback used to persist binding updates.
 * @param props.queryRegistry - Query metadata available to the property inspector.
 * @param props.dashboardParams - Dashboard parameters that query params can bind to.
 * @param props.mappingFields - Widget prop keys that should expose mapping controls.
 * @param props.defaultMappingTransforms - Optional default transforms for specific mapping fields.
 * @returns The data-binding configuration UI for the current widget.
 */
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
      mapping: entry
        ? buildDefaultMapping(widgetType, entry, mappingFields, defaultMappingTransforms)
        : {},
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
