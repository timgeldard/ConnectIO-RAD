import type { CSSProperties } from 'react'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'

export interface DrillDownColumn {
  key: string
  label: string
  width?: number
  align?: 'left' | 'right' | 'center'
}

export interface DrillDownTableWidgetProps extends Record<string, unknown> {
  columns?: DrillDownColumn[]
  rows?: Record<string, unknown>[]
  emptyMessage?: string
  maxHeight?: number
}

function cellStyle(col: DrillDownColumn): CSSProperties {
  return {
    padding: '6px 10px',
    textAlign: col.align ?? 'left',
    fontSize: 12,
    color: 'var(--text-1)',
    borderBottom: '1px solid var(--line-1)',
    whiteSpace: 'nowrap',
    ...(col.width ? { width: col.width, maxWidth: col.width, overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
  }
}

export function DrillDownTableWidget({ config, props, data }: WidgetRenderProps<DrillDownTableWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<DrillDownTableWidgetProps> : {}
  const merged = { ...props, ...source }

  const columns = merged.columns ?? []
  const rows = merged.rows ?? []
  const title = config.title

  return (
    <ChartContainer title={title} description={config.description}>
      {rows.length === 0 ? (
        <div role="status" style={{ padding: 24, color: 'var(--text-3)', fontSize: 12 }}>
          {merged.emptyMessage ?? 'No data available.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: merged.maxHeight }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    style={{
                      ...cellStyle(col),
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      background: 'var(--surface-1)',
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface-0)' : 'var(--surface-1)' }}>
                  {columns.map(col => (
                    <td key={col.key} style={cellStyle(col)}>
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartContainer>
  )
}
