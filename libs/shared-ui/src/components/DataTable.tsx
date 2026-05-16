
/* eslint-disable jsdoc/require-jsdoc */
import { memo, useState, useCallback, type ReactNode, type CSSProperties } from 'react'

export interface Column<T> {
  /** Column header content. */
  header: ReactNode
  /** Row property to render as cell content when no `render` is provided. */
  key?: keyof T & string
  /** Column key used for sort callbacks; falls back to `key` if omitted. */
  sortKey?: string
  /** Horizontal text alignment for header and cells. */
  align?: 'left' | 'right' | 'center'
  /** Fixed column width (px or CSS string). */
  width?: number | string
  /** Renders cell text in the monospace font at a slightly smaller size. */
  mono?: boolean
  /** Applies tabular-nums for aligned number columns. */
  num?: boolean
  /** Renders cell text in the muted text colour. */
  muted?: boolean
  /** Allows cell content to wrap instead of staying on one line. */
  wrap?: boolean
  /** Custom cell renderer; takes precedence over `key`. */
  render?: (row: T, i: number) => ReactNode
  /** Extra CSS class applied to each `<td>`. */
  className?: string
  /** Inline styles applied to each `<td>`. */
  style?: CSSProperties
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
  /** Shows a skeleton loading row when true. */
  loading?: boolean
  /** Column sort key currently active — used to render a sort indicator. */
  sortKey?: string
  /** Sort direction for the active column. */
  sortDir?: 'asc' | 'desc'
  /** Fires when a sortable header is clicked. Column must have sortKey to opt in. */
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  /** When set, renders built-in page controls below the table. */
  pagination?: { pageSize: number }
  /** Selection support for manufacturing bulk actions. */
  selection?: {
    selectedIds: Set<string | number>
    onToggle: (id: string | number) => void
    onToggleAll: () => void
    allSelected: boolean
    someSelected: boolean
  }
}

interface DataTableRowProps<T> {
  row: T
  index: number
  columns: Column<T>[]
  rowPad: string
  emphasize?: (row: T, i: number) => boolean
  rowKeyVal: string | number
  onRowClick?: (row: T, i: number) => void
  isSelected?: boolean
  onToggle?: (id: string | number) => void
}

/** Internal Row component to allow for React.memo optimization. */
const DataTableRow = memo(function DataTableRow<T>({
  row,
  index,
  columns,
  rowPad,
  emphasize,
  rowKeyVal,
  onRowClick,
  isSelected,
  onToggle,
}: DataTableRowProps<T>) {
  const isEmph = emphasize && emphasize(row, index)
  const baseBg = isSelected ? 'var(--surface-sunken)' : (isEmph ? 'var(--surface-sunken)' : 'transparent')
  
  return (
    <tr
      data-testid="data-table-row"
      onClick={onRowClick ? () => onRowClick(row, index) : undefined}
      style={{ cursor: onRowClick ? 'pointer' : 'default', background: baseBg, transition: 'background 120ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = baseBg }}
    >
      {onToggle && (
        <td style={{ padding: rowPad, width: 40 }} onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            aria-label="Select row"
            checked={isSelected} 
            onChange={() => onToggle(rowKeyVal)} 
            style={{ cursor: 'pointer' }}
          />
        </td>
      )}
      {columns.map((c, j) => (
        <td
          key={j}
          className={c.className}
          style={{
            textAlign: c.align || 'left',
            padding: rowPad,
            color: c.muted ? 'var(--text-3)' : 'var(--text-1)',
            fontSize: c.mono ? 11.5 : 12.5,
            fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
            letterSpacing: c.mono ? '0.01em' : 'normal',
            fontVariantNumeric: c.num ? 'tabular-nums' : 'normal',
            borderBottom: '1px solid var(--line-1)',
            whiteSpace: c.wrap ? 'normal' : 'nowrap',
            ...c.style,
          }}
        >
          {c.render ? c.render(row, index) : (c.key ? (row[c.key] as ReactNode) : null)}
        </td>
      ))}
    </tr>
  )
}) as <T>(props: DataTableRowProps<T>) => JSX.Element

export function DataTable<T>({
  columns,
  rows,
  dense = false,
  emphasize,
  rowKey = (_, i) => i,
  onRowClick,
  className,
  style,
  loading = false,
  sortKey: activeSortKey,
  sortDir: activeSortDir = 'asc',
  onSort,
  pagination,
  selection,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const rowPad = dense ? '6px 12px' : '9px 14px'

  const pageSize = pagination?.pageSize ?? rows.length
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = pagination ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows

  const handleHeaderClick = useCallback((col: Column<T>) => {
    const key = col.sortKey ?? (col.key as string | undefined)
    if (!key || !onSort) return
    const nextDir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc'
    onSort(key, nextDir)
  }, [activeSortKey, activeSortDir, onSort])

  const handlePrevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const handleNextPage = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages])

  return (
    <div data-testid="data-table" className={className} style={{ width: '100%', overflowX: 'auto', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 12.5 }}>
        <thead>
          <tr>
            {selection && (
              <th style={{ padding: rowPad, width: 40, borderBottom: '1px solid var(--line-2)', background: 'var(--surface-0)' }}>
                <input 
                  type="checkbox" 
                  aria-label="Select all rows"
                  checked={selection.allSelected} 
                  ref={el => { if (el) el.indeterminate = selection.someSelected }}
                  onChange={selection.onToggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
            )}
            {columns.map((c, i) => {
              const colSortKey = c.sortKey ?? (c.key as string | undefined)
              const isSortable = !!colSortKey && !!onSort
              const isActive = colSortKey === activeSortKey
              return (
                <th
                  key={i}
                  data-testid={`data-table-header${c.key ? `-${String(c.key)}` : ''}`}
                  onClick={isSortable ? () => handleHeaderClick(c) : undefined}
                  style={{
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
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  {c.header}
                  {isSortable && isActive && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      {activeSortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} style={{ padding: rowPad, textAlign: 'center', color: 'var(--text-3)' }}>
                Loading…
              </td>
            </tr>
          )}
          {!loading && visibleRows.map((r, i) => {
            const keyVal = rowKey(r, i)
            return (
              <DataTableRow
                key={keyVal}
                row={r}
                index={i}
                columns={columns}
                rowPad={rowPad}
                emphasize={emphasize}
                rowKeyVal={keyVal}
                onRowClick={onRowClick}
                isSelected={selection?.selectedIds.has(keyVal)}
                onToggle={selection?.onToggle}
              />
            )
          })}
          {!loading && rows.length === 0 && (
            <tr>
              <td data-testid="data-table-empty" colSpan={columns.length + (selection ? 1 : 0)} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)' }}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pagination && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '8px 16px', borderTop: '1px solid var(--line-1)', fontSize: 12, color: 'var(--text-3)' }}>
          <button
            aria-label="Previous page"
            onClick={handlePrevPage}
            disabled={page === 0}
            style={{ background: 'none', border: '1px solid var(--line-1)', borderRadius: 4, padding: '2px 8px', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
          >
            ←
          </button>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{page + 1} / {totalPages}</span>
          <button
            aria-label="Next page"
            onClick={handleNextPage}
            disabled={page >= totalPages - 1}
            style={{ background: 'none', border: '1px solid var(--line-1)', borderRadius: 4, padding: '2px 8px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
