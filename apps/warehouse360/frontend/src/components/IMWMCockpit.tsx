/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useApi } from '~/hooks/useApi'
import { usePlantSelection } from '~/context/PlantContext'
import { Icon, Pill, Progress } from './Primitives'
import { Card, KPI } from './Shared'
import { DataTable, type Column } from '@connectio/shared-ui'

/** A single row from any of the four IMWM live views. */
type Row = Record<string, any>

/** Shape of `GET /api/imwm/stock`. */
interface StockResponse { stock: Row[] }
/** Shape of `GET /api/imwm/movements`. */
interface MovementsResponse { movements: Row[] }
/** Shape of `GET /api/imwm/exceptions`. */
interface ExceptionsResponse { exceptions: Row[] }
/** Shape of `GET /api/imwm/analytics/aging`. */
interface AgingResponse { aging: Row[] }

/** Sort direction type for column sort state. */
type SortDir = 'asc' | 'desc'

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const fmtQty = (value: unknown): string => Math.round(num(value)).toLocaleString()

const fmtMoney = (value: unknown): string =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num(value))

const mismatchTone = (kind?: unknown): string =>
  kind === 'true' ? 'red' : kind === 'timing' ? 'amber' : 'green'

const severityTone = (severity?: unknown): string =>
  num(severity) >= 4 ? 'red' : num(severity) >= 3 ? 'amber' : 'grey'

const stockStatusTone = (status?: unknown): string => {
  switch (String(status ?? '')) {
    case 'Production':   return 'green'
    case 'Consumption':  return 'amber'
    case 'Shipment':     return 'red'
    case 'STO Transfer': return 'sage'
    case 'Transfer':     return 'sage'
    default:             return 'grey'
  }
}

const byCountDesc = ([, a]: [string, number], [, b]: [string, number]) => b - a

const groupCount = (rows: Row[], key: string): [string, number][] => {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const label = String(row[key] ?? '—')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return Array.from(counts.entries()).sort(byCountDesc)
}

const sumByGroup = (rows: Row[], groupKey: string, valueKey: string): Map<string, number> => {
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    const label = String(row[groupKey] ?? '—')
    totals.set(label, (totals.get(label) ?? 0) + num(row[valueKey]))
  })
  return totals
}

const sortRows = (rows: Row[], key: string, dir: SortDir): Row[] => {
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    const an = Number(av)
    const bn = Number(bv)
    let cmp: number
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      cmp = an - bn
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''))
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

const LiveError = ({ label, error }: { label: string; error: string | null }) =>
  error ? <div className="red small">Unable to load live {label}: {error}</div> : null

const PAGE_SIZE = 50

export const IMWMCockpit = () => {
  const { plants, selectedPlantId, setSelectedPlantId, loading: plantLoading } = usePlantSelection()
  const [tab, setTab] = React.useState('stock')
  const { data: stockResp, loading: stockLoading, error: stockError } = useApi<StockResponse>('/api/imwm/stock')
  const { data: movementsResp, loading: movementsLoading, error: movementsError } = useApi<MovementsResponse>('/api/imwm/movements')
  const { data: exceptionsResp, loading: exceptionsLoading, error: exceptionsError } = useApi<ExceptionsResponse>('/api/imwm/exceptions')
  const { data: agingResp, loading: agingLoading, error: agingError } = useApi<AgingResponse>('/api/imwm/analytics/aging')

  const stock: Row[] = React.useMemo(() => stockResp?.stock ?? [], [stockResp])
  const movements: Row[] = React.useMemo(() => movementsResp?.movements ?? [], [movementsResp])
  const exceptions: Row[] = React.useMemo(() => exceptionsResp?.exceptions ?? [], [exceptionsResp])
  const aging: Row[] = React.useMemo(() => agingResp?.aging ?? [], [agingResp])

  // ⚡ Bolt: Consolidated multiple O(n) array passes (reduce, filter) into single-pass for...of loops.
  // 🎯 Why: Previously, these values were computed on every render, and required multiple allocations and iterations over the large `stock`, `exceptions` and `aging` arrays.
  // 📊 Impact: O(N) complexity instead of O(K * N) where K is number of filter/reduce calls. Reduces unneeded re-evaluations, improving page interaction latency and preventing the UI thread from dropping frames when dataset is large.
  const { totalValue, trueMismatches, timingGaps, absoluteDelta } = React.useMemo(() => {
    let tValue = 0
    let aDelta = 0
    const tMismatches: Row[] = []
    const tGaps: Row[] = []

    for (const row of stock) {
      tValue += num(row.inventory_value_eur)
      aDelta += Math.abs(num(row.delta_qty))
      if (row.mismatch_kind === 'true') {
        tMismatches.push(row)
      } else if (row.mismatch_kind === 'timing') {
        tGaps.push(row)
      }
    }

    return {
      totalValue: tValue,
      trueMismatches: tMismatches,
      timingGaps: tGaps,
      absoluteDelta: aDelta,
    }
  }, [stock])

  const sev4 = React.useMemo(() => {
    const s4: Row[] = []
    for (const row of exceptions) {
      if (num(row.severity) >= 4) {
        s4.push(row)
      }
    }
    return s4
  }, [exceptions])

  const { agedValue, maxAgingValue } = React.useMemo(() => {
    let aValue = 0
    let maxValue = 1
    for (const row of aging) {
      const val = num(row.total_value_eur)
      if (num(row.age_bucket_order) >= 4) {
        aValue += val
      }
      if (val > maxValue) {
        maxValue = val
      }
    }
    return { agedValue: aValue, maxAgingValue: maxValue }
  }, [aging])

  const plantExposure: Map<string, number> = React.useMemo(
    () => sumByGroup(stock, 'plant_id', 'inventory_value_eur'),
    [stock],
  )

  const [showMatch, setShowMatch] = React.useState(true)
  const [showTiming, setShowTiming] = React.useState(true)
  const [showTrue, setShowTrue] = React.useState(true)
  const [wmOnly, setWmOnly] = React.useState(false)

  const [stockSortKey, setStockSortKey] = React.useState('material_name')
  const [stockSortDir, setStockSortDir] = React.useState<SortDir>('asc')
  const [stockPage, setStockPage] = React.useState(0)

  const [excSortKey, setExcSortKey] = React.useState('severity')
  const [excSortDir, setExcSortDir] = React.useState<SortDir>('desc')
  const [excPage, setExcPage] = React.useState(0)

  React.useEffect(() => {
    setStockPage(0)
  }, [showMatch, showTiming, showTrue, wmOnly, stockSortKey])

  React.useEffect(() => {
    setExcPage(0)
  }, [excSortKey])

  const filteredStock: Row[] = React.useMemo(() => {
    const filtered = stock.filter((row) => {
      const kind = row.mismatch_kind
      if (kind === 'match' && !showMatch) return false
      if (kind === 'timing' && !showTiming) return false
      if (kind === 'true' && !showTrue) return false
      if (wmOnly && row.wm_managed !== true) return false
      return true
    })
    return sortRows(filtered, stockSortKey, stockSortDir)
  }, [stock, showMatch, showTiming, showTrue, wmOnly, stockSortKey, stockSortDir])

  const sortedExceptions: Row[] = React.useMemo(
    () => sortRows(exceptions, excSortKey, excSortDir),
    [exceptions, excSortKey, excSortDir],
  )

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12,
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    background: active ? 'var(--surface-3)' : 'var(--surface-1)',
    color: active ? 'var(--text-1)' : 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  })

  const stockColumns: Column<Row>[] = React.useMemo(() => [
    { header: 'Material', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.material_name ?? row.material_id ?? '—')}</div><div className="muted mono small">{String(row.material_id ?? '—')}</div></>, sortKey: 'material_name' },
    { header: 'Plant', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.plant_name ?? row.plant_id ?? '—')}</div><div className="muted mono small">{String(row.plant_id ?? '—')}</div></>, sortKey: 'plant_id' },
    { header: 'Storage', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.storage_loc_name ?? row.storage_loc ?? '—')}</div><div className="muted mono small">{String(row.storage_loc ?? '—')}</div></>, sortKey: 'storage_loc' },
    { header: 'IM qty', align: 'right', render: (row) => `${fmtQty(row.im_total_qty)} ${String(row.uom ?? '')}`, sortKey: 'im_total_qty' },
    { header: 'WM qty', align: 'right', render: (row) => `${fmtQty(row.wm_total_qty)} ${String(row.uom ?? '')}`, sortKey: 'wm_total_qty' },
    { header: 'Delta', align: 'right', render: (row) => <span className={num(row.delta_qty) !== 0 ? 'bold amber' : ''}>{fmtQty(row.delta_qty)}</span>, sortKey: 'delta_qty' },
    { header: 'Value', align: 'right', render: (row) => fmtMoney(row.inventory_value_eur), sortKey: 'inventory_value_eur' },
    { header: 'Status', render: (row) => <Pill tone={mismatchTone(row.mismatch_kind)}>{String(row.mismatch_kind ?? '—')}</Pill>, sortKey: 'mismatch_kind' }
  ], []);

  const stockLookup = React.useMemo(() => {
    const map = new Map<string, Row>()
    stock.forEach((s) => {
      const k = `${String(s.material_id ?? '')}:${String(s.plant_id ?? '')}:${String(s.storage_loc ?? '')}`
      map.set(k, s)
    })
    return map
  }, [stock])

  const excColumns: Column<Row>[] = React.useMemo(() => [
    { header: 'Type', render: (row) => <Pill tone={severityTone(row.severity)}>{String(row.exception_type ?? '—')}</Pill>, sortKey: 'exception_type' },
    { header: 'Sev', align: 'right', key: 'severity', sortKey: 'severity' },
    { header: 'SLA', align: 'right', render: (row) => row.sla_hours != null ? `${row.sla_hours}h` : '—', sortKey: 'sla_hours' },
    { header: 'Material', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.material_name ?? row.material_id ?? '—')}</div>{row.material_id && <div className="mono muted" style={{ fontSize: 11 }}>{String(row.material_id)}</div>}</>, sortKey: 'material_name' },
    { header: 'Storage', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.storage_loc_name ?? row.storage_loc ?? '—')}</div>{row.storage_loc && <div className="mono muted" style={{ fontSize: 11 }}>{String(row.storage_loc)}</div>}</>, sortKey: 'storage_loc_name' },
    { header: 'Plant', key: 'plant_id', mono: true, sortKey: 'plant_id' },
    { header: 'Qty', align: 'right', render: (row) => row.qty != null ? fmtQty(row.qty) : '—', sortKey: 'qty' },
    { header: 'Value', align: 'right', render: (row) => {
      const k = `${String(row.material_id ?? '')}:${String(row.plant_id ?? '')}:${String(row.storage_loc ?? '')}`
      const stockMatch = row.material_id && row.plant_id && row.storage_loc ? stockLookup.get(k) : undefined
      return stockMatch ? fmtMoney(num(stockMatch.inventory_value_eur)) : '—'
    }, sortKey: 'inventory_value_eur' },
    { header: 'Batch', key: 'batch_id', mono: true },
    { header: 'Bin', key: 'bin_id', mono: true },
    { header: 'Detail', render: (row) => <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{String(row.detail_text ?? '—')}</span> }
  ], [stockLookup]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inventory · IM/WM reconciliation</div>
          <h1 className="page-title">Inventory Cockpit</h1>
          <div className="page-desc">Live SAP IM and WM comparison, movement activity, exception queue, and aged inventory value.</div>
        </div>
        <div className="page-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Plant</span>
            <select
              value={selectedPlantId}
              disabled={plantLoading || plants.length === 0}
              onChange={(e) => setSelectedPlantId(e.target.value)}
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-1)' }}
            >
              {plants.length === 0 && <option value="">{plantLoading ? 'Loading…' : 'No plants'}</option>}
              {plants.map((p) => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.plant_name && p.plant_name !== p.plant_id ? `${p.plant_name} · ${p.plant_id}` : p.plant_id}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary" disabled title="Refresh — coming soon"><Icon name="refresh" size={14}/> Refresh</button>
          <button className="btn btn-primary" disabled title="Export queue — coming soon"><Icon name="download" size={14}/> Export queue</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Stock rows" value={stockLoading ? '...' : stock.length.toLocaleString()} tone="ok"/>
        <KPI label="True mismatches" value={stockLoading ? '...' : trueMismatches.length.toLocaleString()} tone={trueMismatches.length ? 'risk' : 'ok'}/>
        <KPI label="Timing gaps" value={stockLoading ? '...' : timingGaps.length.toLocaleString()} tone={timingGaps.length ? 'warn' : 'ok'}/>
        <KPI label="Absolute delta" value={stockLoading ? '...' : fmtQty(absoluteDelta)} tone={absoluteDelta ? 'warn' : 'ok'}/>
        <KPI label="Open exceptions" value={exceptionsLoading ? '...' : exceptions.length.toLocaleString()} tone={exceptions.length ? 'risk' : 'ok'}/>
        <KPI label="Aged value >90d" value={agingLoading ? '...' : fmtMoney(agedValue)} tone={agedValue ? 'warn' : 'ok'}/>
      </div>

      <div className="tabs">
        {[
          { id: 'stock', label: 'Stock comparison' },
          { id: 'exceptions', label: 'Exceptions' },
          { id: 'movements', label: 'Movements' },
          { id: 'aging', label: 'Aging' },
        ].map((tabDef) => (
          <button key={tabDef.id} className={`tab ${tab === tabDef.id ? 'is-active' : ''}`} onClick={() => setTab(tabDef.id)}>
            {tabDef.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card title="Mismatch mix" subtitle="Rows grouped by live reconciliation classification" eyebrow="IMWM">
              <div className="stack-8">
                {groupCount(stock, 'mismatch_kind').map(([kind, count]) => {
                  const pct = stock.length ? Math.round((count / stock.length) * 100) : 0
                  return (
                    <div key={kind}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Pill tone={mismatchTone(kind)}>{kind}</Pill>
                        <span className="mono small muted">{count.toLocaleString()} · {pct}%</span>
                      </div>
                      <Progress pct={pct} tone={mismatchTone(kind) === 'red' ? 'red' : mismatchTone(kind) === 'amber' ? 'amber' : ''}/>
                    </div>
                  )
                })}
                {!stockLoading && stock.length === 0 && <div className="muted small">No live IM/WM comparison rows are available for the selected plant.</div>}
                <LiveError label="IM/WM comparison rows" error={stockError}/>
              </div>
            </Card>
            <Card title="Plant exposure" subtitle="Inventory value by plant from the comparison view" eyebrow="Value">
              <div className="stack-8">
                {groupCount(stock, 'plant_id').slice(0, 8).map(([plant]) => {
                  const value = plantExposure.get(plant) ?? 0
                  const pct = totalValue ? Math.round((value / totalValue) * 100) : 0
                  return (
                    <div key={plant}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="mono small">{plant}</span>
                        <span className="mono small muted">{fmtMoney(value)} · {pct}%</span>
                      </div>
                      <Progress pct={pct}/>
                    </div>
                  )
                })}
                {!stockLoading && stock.length === 0 && <div className="muted small">No live plant exposure is available.</div>}
              </div>
            </Card>
          </div>

          <Card title="Live stock comparison" subtitle="Material · plant · storage location · IM · WM · delta" eyebrow="imwm_stock_comparison_v" noPad>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 8px', flexWrap: 'wrap' }}>
              <button style={toggleStyle(showMatch)} onClick={() => setShowMatch((v) => !v)}>Match</button>
              <button style={toggleStyle(showTiming)} onClick={() => setShowTiming((v) => !v)}>Timing</button>
              <button style={toggleStyle(showTrue)} onClick={() => setShowTrue((v) => !v)}>True variance</button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
              <button style={toggleStyle(wmOnly)} onClick={() => setWmOnly((v) => !v)}>WM managed only</button>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                Showing {filteredStock.length.toLocaleString()} of {stock.length.toLocaleString()} rows
              </span>
            </div>
            <DataTable
              columns={stockColumns}
              rows={filteredStock}
              rowKey={(row, i) => `${row.material_id}-${row.plant_id}-${row.storage_loc}-${i}`}
              dense
              loading={stockLoading}
              pagination={{ pageSize: PAGE_SIZE }}
              sortKey={stockSortKey}
              sortDir={stockSortDir}
              onSort={(key, dir) => { setStockSortKey(key); setStockSortDir(dir); }}
              emphasize={(row) => row.mismatch_kind === 'true'}
            />
            {stockError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{stockError}</div>}
          </Card>
        </>
      )}

      {tab === 'exceptions' && (
        <Card title="Exception queue" subtitle={`${sev4.length} severity-4 rows require immediate attention`} eyebrow="imwm_exceptions_v" noPad>
          <DataTable
            columns={excColumns}
            rows={sortedExceptions}
            rowKey={(row, i) => `${row.exception_type}-${row.material_id}-${i}`}
            dense
            loading={exceptionsLoading}
            pagination={{ pageSize: PAGE_SIZE }}
            sortKey={excSortKey}
            sortDir={excSortDir}
            onSort={(key, dir) => { setExcSortKey(key); setExcSortDir(dir); }}
            emphasize={(row) => num(row.severity) >= 4}
          />
          {exceptionsError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{exceptionsError}</div>}
        </Card>
      )}

      {tab === 'movements' && (
        <Card title="Recent IM movements" subtitle="SAP material document activity (MSEG) from the last 24 hours" eyebrow="imwm_movements_v" noPad>
          <DataTable
            columns={[
              { header: 'Document', key: 'document_number', mono: true },
              { header: 'Posting date', render: (row) => <span className="mono small">{String(row.posting_date ?? '—')} {String(row.posting_time ?? '')}</span> },
              { header: 'Movement', render: (row) => <Pill tone="grey">{String(row.movement_type ?? '—')}</Pill> },
              { header: 'Status', render: (row) => <Pill tone={stockStatusTone(row.stock_status)}>{String(row.stock_status ?? '—')}</Pill> },
              { header: 'Material', render: (row) => <><div style={{ fontSize: 12 }}>{String(row.material_name ?? row.material_id ?? '—')}</div><div className="muted mono small">{String(row.material_id ?? '—')}</div></> },
              { header: 'Plant', key: 'plant_id', mono: true },
              { header: 'Storage', key: 'storage_loc', mono: true },
              { header: 'Qty', align: 'right', render: (row) => {
                const qty = num(row.quantity)
                const qtyColor = qty > 0 ? 'var(--green)' : qty < 0 ? 'var(--red)' : undefined
                return <span style={{ color: qtyColor, fontWeight: qty !== 0 ? 600 : undefined }}>{fmtQty(qty)} {String(row.uom ?? '')}</span>
              }},
              { header: 'User', key: 'username', mono: true }
            ]}
            rows={movements.slice(0, 200)}
            rowKey={(row, i) => `${row.document_number}-${i}`}
            dense
            loading={movementsLoading}
          />
          {movementsError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{movementsError}</div>}
        </Card>
      )}

      {tab === 'aging' && (
        <Card title="Aged inventory value" subtitle="Batch-derived age buckets by plant" eyebrow="imwm_analytics_aging_v">
          <div className="stack-8">
            {aging.map((row, index) => {
              const value = num(row.total_value_eur)
              return (
                <div key={`${row.plant_id}-${row.age_bucket}-${index}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span><span className="mono small">{String(row.plant_id ?? '—')}</span> · {String(row.age_bucket ?? '—')}</span>
                    <span className="mono small muted">{fmtMoney(value)} · {num(row.material_count).toLocaleString()} materials</span>
                  </div>
                  <Progress pct={(value / maxAgingValue) * 100} tone={num(row.age_bucket_order) >= 4 ? 'amber' : ''}/>
                </div>
              )
            })}
            {!agingLoading && aging.length === 0 && <div className="muted small">No live IM/WM aging rows are available for this plant.</div>}
            <LiveError label="IM/WM aging rows" error={agingError}/>
          </div>
        </Card>
      )}
    </div>
  )
}
