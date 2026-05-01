import type { ReactNode, CSSProperties } from 'react'

export interface Column<T> {
  header: ReactNode
  key?: keyof T
  align?: 'left' | 'right' | 'center'
  width?: number | string
  mono?: boolean
  num?: boolean
  muted?: boolean
  wrap?: boolean
  render?: (row: T, i: number) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  dense?: boolean
  emphasize?: (row: T, i: number) => boolean
  rowKey?: (row: T, i: number) => string | number
  onRowClick?: (row: T, i: number) => void
  className?: string
  style?: CSSProperties
}

export function DataTable<T>({
  columns,
  rows,
  dense = false,
  emphasize,
  rowKey = (_, i) => i,
  onRowClick,
  className,
  style,
}: DataTableProps<T>) {
  const rowPad = dense ? '6px 12px' : '9px 14px'

  return (
    <div className={className} style={{ width: '100%', overflowX: 'auto', ...style }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-sans)',
        fontSize: 12.5,
      }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || 'left',
                padding: rowPad,
                color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--line-2)',
                background: 'var(--surface-0)',
                whiteSpace: 'nowrap',
                width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isEmph = emphasize && emphasize(r, i)
            const baseBg = isEmph ? 'var(--surface-sunken)' : 'transparent'
            return (
              <tr
                key={rowKey(r, i)}
                onClick={onRowClick ? () => onRowClick(r, i) : undefined}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  background: baseBg,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-sunken)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = baseBg
                }}
              >
                {columns.map((c, j) => (
                  <td key={j} style={{
                    textAlign: c.align || 'left',
                    padding: rowPad,
                    color: c.muted ? 'var(--text-3)' : 'var(--text-1)',
                    fontSize: c.mono ? 11.5 : 12.5,
                    fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
                    letterSpacing: c.mono ? '0.01em' : 'normal',
                    fontVariantNumeric: c.num ? 'tabular-nums' : 'normal',
                    borderBottom: '1px solid var(--line-1)',
                    whiteSpace: c.wrap ? 'normal' : 'nowrap',
                  }}>
                    {c.render ? c.render(r, i) : (c.key ? (r[c.key] as ReactNode) : null)}
                  </td>
                ))}
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)' }}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
