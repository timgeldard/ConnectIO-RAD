import { useCallback, useMemo, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../SPCContext'
import { useExport } from '../hooks/useExport'
import type { ScorecardRow } from '../types'
import VirtualizedRows from './VirtualizedRows'
import CpkBar from './CpkBar'

type SortMode = 'status' | 'cpk' | 'ooc'

const STATUS_ORDER: Record<string, number> = {
  poor: 0, out_of_spec_mean: 0,
  marginal: 1,
  good: 2, excellent: 2,
  grey: 3,
}

const STABILITY_GUARD_ENABLED = import.meta.env?.VITE_DISABLE_STABILITY_GUARD !== 'true'

const VIRTUALIZATION_THRESHOLD = 250

interface ColumnSpec { key: string; label: string; value: (row: ScorecardRow) => string | number }

const CSV_COLUMNS: ColumnSpec[] = [
  { key: 'mic_name',          label: 'Characteristic', value: r => r.mic_name              },
  { key: 'batch_count',       label: 'Batches',        value: r => r.batch_count            },
  { key: 'mean_value',        label: 'Mean',           value: r => r.mean_value    ?? ''    },
  { key: 'stddev_overall',    label: 'Std Dev',        value: r => r.stddev_overall ?? ''   },
  { key: 'nominal_target',    label: 'Target',         value: r => r.nominal_target ?? ''   },
  { key: 'pp',                label: 'Pp',             value: r => r.pp            ?? ''    },
  { key: 'cpk',               label: 'Cpk',            value: r => r.cpk           ?? ''    },
  { key: 'ppk',               label: 'Ppk',            value: r => r.ppk           ?? ''    },
  { key: 'ooc_rate',          label: 'OOC Rate',       value: r => r.ooc_rate      ?? ''    },
  { key: 'capability_status', label: 'Status',         value: r => r.capability_status ?? '' },
]

function downloadCsv(filename: string, columns: ColumnSpec[], rows: ScorecardRow[]) {
  const escapeCell = (value: string | number) => {
    const text = String(value ?? '')
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
    return safe
  }
  const lines = [
    columns.map(c => escapeCell(c.label)).join(','),
    ...rows.map(row => columns.map(c => escapeCell(c.value(row))).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fmt(value: number | null | undefined, digits: number): string {
  return value == null ? '—' : value.toFixed(digits)
}

function statusTone(status: string | null | undefined): string {
  if (status === 'poor' || status === 'out_of_spec_mean') return 'risk'
  if (status === 'marginal') return 'warn'
  if (status === 'good' || status === 'excellent') return 'ok'
  return 'neutral'
}

function statusLabel(status: string | null | undefined, unstable: boolean): string {
  if (unstable && STABILITY_GUARD_ENABLED) return 'Unstable'
  if (status === 'excellent') return 'Excellent'
  if (status === 'good') return 'Capable'
  if (status === 'marginal') return 'Marginal'
  if (status === 'poor' || status === 'out_of_spec_mean') return 'Not capable'
  return 'No data'
}

interface ScorecardTableProps {
  rows: ScorecardRow[]
  material?: string
}

export default function ScorecardTable({ rows, material }: ScorecardTableProps) {
  const dispatch = useSPCDispatch()
  const state = useSPCSelector(
    current => ({
      selectedMaterial: current.selectedMaterial,
      selectedPlant: current.selectedPlant,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    }),
    shallowEqual,
  )
  const { exportData, exporting } = useExport()

  const [sortMode, setSortMode] = useState<SortMode>('status')
  const [density, setDensity] = useState<'regular' | 'compact'>('regular')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [virtualize, setVirtualize] = useState(false)

  const cellPad = density === 'compact' ? '8px 14px' : '14px 16px'

  const openChart = useCallback((row: ScorecardRow) => {
    dispatch({ type: 'SET_MIC', payload: { mic_id: row.mic_id, mic_name: row.mic_name, chart_type: 'imr' } })
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'charts' })
  }, [dispatch])

  const exportExcel = useCallback(() => {
    void exportData({
      export_type: 'excel',
      export_scope: 'scorecard',
      material_id: state.selectedMaterial?.material_id,
      plant_id: state.selectedPlant?.plant_id ?? null,
      date_from: state.dateFrom || null,
      date_to: state.dateTo || null,
    })
  }, [exportData, state.dateFrom, state.dateTo, state.selectedMaterial, state.selectedPlant])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortMode === 'status') {
        const ao = STATUS_ORDER[a.capability_status ?? 'grey'] ?? 3
        const bo = STATUS_ORDER[b.capability_status ?? 'grey'] ?? 3
        if (ao !== bo) return ao - bo
        return (a.cpk ?? 99) - (b.cpk ?? 99)
      }
      if (sortMode === 'cpk') return (a.cpk ?? 99) - (b.cpk ?? 99)
      if (sortMode === 'ooc') return (b.ooc_rate ?? 0) - (a.ooc_rate ?? 0)
      return 0
    })
  }, [rows, sortMode])

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return sortedRows
    const lower = searchTerm.toLowerCase()
    return sortedRows.filter(r => r.mic_name.toLowerCase().includes(lower))
  }, [sortedRows, searchTerm])

  const pageStart = (page - 1) * pageSize
  const pageRows = virtualize ? filteredRows : filteredRows.slice(pageStart, pageStart + pageSize)
  const totalPages = Math.ceil(filteredRows.length / pageSize)

  const exportCSV = useCallback(
    () => downloadCsv('spc_scorecard.csv', CSV_COLUMNS, filteredRows),
    [filteredRows],
  )

  const renderRow = (r: ScorecardRow, i: number, isVirtualized = false) => {
    const tone = statusTone(r.capability_status)
    const chipClass = `chip chip-${tone === 'neutral' ? '' : tone}`.trim()
    const unstable = r.is_stable === false
    const trendIcon = unstable || r.is_stable === false
      ? 'trending-down'
      : r.is_stable === true
      ? 'trending-up'
      : 'activity'
    const trendColor = unstable ? 'var(--status-risk)'
      : r.is_stable === true ? 'var(--status-ok)'
      : 'var(--text-3)'
    const trendLabel = unstable ? 'Degrading' : r.is_stable === true ? 'Stable' : 'Flat'

    return (
      <tr
        key={r.mic_id}
        style={{
          borderBottom: '1px solid var(--line-1)',
          background: !isVirtualized && i % 2 !== 0
            ? 'transparent'
            : 'color-mix(in srgb, var(--surface-2) 40%, transparent)',
        }}
        className="row-hover"
      >
        <td style={{ padding: cellPad }}>
          <span className={chipClass} style={{ fontSize: 10.5 }}>
            {statusLabel(r.capability_status, unstable)}
          </span>
        </td>
        <td style={{ padding: cellPad }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{r.mic_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            <span className="mono">{r.mic_id}</span>
          </div>
        </td>
        <td style={{ padding: cellPad }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
        </td>
        <td style={{ padding: cellPad, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
          {r.nominal_target != null ? `T: ${r.nominal_target.toFixed(4)}` : '—'}
        </td>
        <td style={{ padding: cellPad, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {fmt(r.mean_value, 4)}
        </td>
        <td style={{ padding: cellPad, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
          {fmt(r.stddev_overall, 4)}
        </td>
        <td style={{ padding: cellPad }}>
          <CpkBar cpk={unstable && STABILITY_GUARD_ENABLED ? null : r.cpk} />
        </td>
        <td style={{ padding: cellPad, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
          {fmt(r.ppk, 2)}
        </td>
        <td style={{ padding: cellPad }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: trendColor, fontSize: 12 }}>
            <Icon name={trendIcon} size={13} />
            {trendLabel}
          </span>
        </td>
        <td style={{ padding: cellPad }}>
          {(r.ooc_rate ?? 0) > 0 ? (
            <span
              className={`chip chip-${r.ooc_rate! > 0.1 ? 'risk' : 'warn'}`}
              style={{ fontSize: 10.5 }}
            >
              {(r.ooc_rate! * 100).toFixed(1)}%
            </span>
          ) : (
            <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>
          )}
        </td>
        <td style={{ padding: cellPad, fontSize: 12 }}>
          <button
            className="btn-link"
            style={{ fontSize: 12 }}
            onClick={() => openChart(r)}
          >
            Open →
          </button>
        </td>
      </tr>
    )
  }

  const TABLE_HEADERS = ['Status', 'Characteristic', 'Chart', 'Spec', 'Mean', 'σ', 'Capability (Cpk)', 'Ppk', 'Trend', 'Signals', 'Last']

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Characteristic scorecard</div>
        {material && <span className="chip chip-slate">{material}</span>}
        <input
          className="field"
          type="search"
          placeholder="Filter characteristics…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
          style={{ width: 200, marginLeft: 8 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="eyebrow" style={{ marginRight: 4 }}>Sort</div>
          {(['status', 'cpk', 'ooc'] as const).map(v => (
            <button
              key={v}
              onClick={() => setSortMode(v)}
              style={{
                padding: '4px 10px', fontSize: 11.5, borderRadius: 5,
                background: sortMode === v ? 'var(--valentia-slate)' : 'transparent',
                color: sortMode === v ? 'white' : 'var(--text-2)',
                border: '1px solid',
                borderColor: sortMode === v ? 'var(--valentia-slate)' : 'var(--line-1)',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {v === 'status' ? 'Status' : v === 'cpk' ? 'Cpk' : 'OOC'}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--line-1)', margin: '0 4px' }} />
          <button
            className="icon-btn"
            title="Toggle density"
            onClick={() => setDensity(d => d === 'compact' ? 'regular' : 'compact')}
          >
            <Icon name={density === 'compact' ? 'layout' : 'grid'} size={14} />
          </button>
          <button
            className="btn btn-subtle btn-sm"
            onClick={exportCSV}
          >
            <Icon name="download" size={12} /> CSV
          </button>
          <button
            className="btn btn-subtle btn-sm"
            onClick={exportExcel}
            disabled={exporting}
          >
            <Icon name="download" size={12} /> Excel
          </button>
          {filteredRows.length > VIRTUALIZATION_THRESHOLD && !virtualize && (
            <button className="btn btn-subtle btn-sm" onClick={() => setVirtualize(true)}>
              All {filteredRows.length}
            </button>
          )}
        </div>
      </div>

      {/* Virtualized mode */}
      {virtualize ? (
        <div style={{ padding: '8px 18px 4px', borderBottom: '1px solid var(--line-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filteredRows.length} characteristics (virtualized)</span>
          <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setVirtualize(false)}>Use paginated view</button>
        </div>
      ) : null}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {virtualize ? (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  {TABLE_HEADERS.map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--line-1)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
            <VirtualizedRows
              rows={filteredRows}
              rowHeightPx={density === 'compact' ? 40 : 56}
              viewportHeightPx={560}
              ariaLabel="Scorecard characteristics"
              renderRow={(row, i) => (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>{renderRow(row, i, true)}</tbody>
                </table>
              )}
            />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {TABLE_HEADERS.map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--line-1)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((r, i) => renderRow(r, i))
              ) : (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    No characteristics match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!virtualize && totalPages > 1 && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {filteredRows.length} characteristic{filteredRows.length !== 1 ? 's' : ''}
            {' · '}page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-subtle btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn btn-subtle btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
