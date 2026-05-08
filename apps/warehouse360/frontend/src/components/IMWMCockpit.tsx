import React from 'react'
import { useApi } from '~/hooks/useApi'
import { Icon, Pill, Progress } from './Primitives'
import { Card, KPI } from './Shared'

/** A single row from any of the four IMWM live views. The columns vary by
 * view (stock vs. exceptions vs. movements vs. aging) so the type stays a
 * permissive record at the row boundary; the consuming JSX accesses
 * specific fields and tolerates absences via `?? '—'` formatting. */
type Row = Record<string, unknown>

/** Shape of `GET /api/imwm/stock` — a list of comparison rows backed by
 * `imwm_stock_comparison_v`. */
interface StockResponse { stock: Row[] }
/** Shape of `GET /api/imwm/movements`. */
interface MovementsResponse { movements: Row[] }
/** Shape of `GET /api/imwm/exceptions`. */
interface ExceptionsResponse { exceptions: Row[] }
/** Shape of `GET /api/imwm/analytics/aging`. */
interface AgingResponse { aging: Row[] }

/** Coerce a possibly-string-or-null value into a finite number, defaulting
 * to 0 when the input is null/undefined/non-numeric. The Databricks SQL
 * Statement API returns numerics as strings, so most of the IMWM fields
 * arrive as `string`. */
const num = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Render a numeric value as a thousands-grouped integer ("12,345"). */
const fmtQty = (value: unknown): string => Math.round(num(value)).toLocaleString()

/** Render a numeric value as a EUR currency string ("€1,234"). */
const fmtMoney = (value: unknown): string =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num(value))

/** Map a mismatch classification ('match' | 'timing' | 'true') to a Pill tone. */
const mismatchTone = (kind?: unknown): string =>
  kind === 'true' ? 'red' : kind === 'timing' ? 'amber' : 'green'

/** Map a numeric severity (4+ critical, 3 warning, otherwise grey) to a Pill tone. */
const severityTone = (severity?: unknown): string =>
  num(severity) >= 4 ? 'red' : num(severity) >= 3 ? 'amber' : 'grey'

/** Sort comparator: descending by the second tuple element (a count). */
const byCountDesc = ([, a]: [string, number], [, b]: [string, number]) => b - a

/** Group rows by a column value and return entries sorted by count descending.
 *
 * @param rows  Rows to group.
 * @param key   Column name to group by; missing values render as "—".
 * @returns     Entries of `[label, count]`, count-DESC.
 */
const groupCount = (rows: Row[], key: string): [string, number][] => {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const label = String(row[key] ?? '—')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return Array.from(counts.entries()).sort(byCountDesc)
}

/** Pre-aggregate a numeric column by another column in a single pass.
 *
 * Used for the "Plant exposure" panel which needs `SUM(value) GROUP BY
 * plant_id`. Doing this with `rows.filter(...).reduce(...)` per plant
 * inside the render loop is O(plants × rows); on the 2000-row backend
 * cap that's >100k operations per render. A Map walk is O(rows).
 *
 * @param rows       Rows to aggregate.
 * @param groupKey   Column to group by.
 * @param valueKey   Column whose value is summed within each group.
 * @returns          Map from group label to summed value.
 */
const sumByGroup = (rows: Row[], groupKey: string, valueKey: string): Map<string, number> => {
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    const label = String(row[groupKey] ?? '—')
    totals.set(label, (totals.get(label) ?? 0) + num(row[valueKey]))
  })
  return totals
}

/** Inline error banner shown when a live IMWM view fails to load. */
const LiveError = ({ label, error }: { label: string; error: string | null }) =>
  error ? <div className="red small">Unable to load live {label}: {error}</div> : null

/** Inventory Cockpit for the IMWM (IM vs. WM reconciliation) module.
 *
 * Renders a four-tab live view of stock comparison, exception queue,
 * goods movements, and aging buckets, backed by the four
 * `imwm_*_v` gold views via the `/api/imwm/*` endpoints. KPI strip at
 * the top derives counts and aggregates from the same data so a single
 * fetch round trip drives both the strip and the active tab.
 */
export const IMWMCockpit = () => {
  const [tab, setTab] = React.useState('stock')
  const { data: stockResp, loading: stockLoading, error: stockError } = useApi<StockResponse>('/api/imwm/stock')
  const { data: movementsResp, loading: movementsLoading, error: movementsError } = useApi<MovementsResponse>('/api/imwm/movements')
  const { data: exceptionsResp, loading: exceptionsLoading, error: exceptionsError } = useApi<ExceptionsResponse>('/api/imwm/exceptions')
  const { data: agingResp, loading: agingLoading, error: agingError } = useApi<AgingResponse>('/api/imwm/analytics/aging')

  const stock: Row[] = React.useMemo(() => stockResp?.stock ?? [], [stockResp])
  const movements: Row[] = React.useMemo(() => movementsResp?.movements ?? [], [movementsResp])
  const exceptions: Row[] = React.useMemo(() => exceptionsResp?.exceptions ?? [], [exceptionsResp])
  const aging: Row[] = React.useMemo(() => agingResp?.aging ?? [], [agingResp])

  const totalValue = stock.reduce((sum, row) => sum + num(row.inventory_value_eur), 0)
  const trueMismatches = stock.filter((row) => row.mismatch_kind === 'true')
  const timingGaps = stock.filter((row) => row.mismatch_kind === 'timing')
  const absoluteDelta = stock.reduce((sum, row) => sum + Math.abs(num(row.delta_qty)), 0)
  const sev4 = exceptions.filter((row) => num(row.severity) >= 4)
  const agedValue = aging.filter((row) => num(row.age_bucket_order) >= 4).reduce((sum, row) => sum + num(row.total_value_eur), 0)
  const maxAgingValue = Math.max(1, ...aging.map((row) => num(row.total_value_eur)))

  // Pre-aggregate value-per-plant in a single O(rows) pass so the Plant
  // exposure panel below renders in O(plants) — not O(plants × rows) as
  // the previous filter+reduce-per-plant pattern was.
  const plantExposure: Map<string, number> = React.useMemo(
    () => sumByGroup(stock, 'plant_id', 'inventory_value_eur'),
    [stock],
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inventory · IM/WM reconciliation</div>
          <h1 className="page-title">Inventory Cockpit</h1>
          <div className="page-desc">Live SAP IM and WM comparison, movement activity, exception queue, and aged inventory value.</div>
        </div>
        <div className="page-actions">
          {/*
            Refresh and Export are deliberately disabled for now — wiring
            them up requires the useApi hook to expose a refetch handle
            and a CSV-export endpoint that doesn't exist yet. The buttons
            are kept (rather than removed) so the layout doesn't reflow
            when those backends land. See TODO.md.
          */}
          <button className="btn btn-secondary" disabled title="Refresh — coming soon"><Icon name="refresh" size={14}/> Refresh</button>
          <button className="btn btn-primary" disabled title="Export queue — coming soon"><Icon name="download" size={14}/> Export queue</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Stock rows" value={stockLoading ? '...' : stock.length.toLocaleString()} tone="ok"/>
        <KPI label="True mismatches" value={stockLoading ? '...' : trueMismatches.length.toLocaleString()} tone={trueMismatches.length ? 'critical' : 'ok'}/>
        <KPI label="Timing gaps" value={stockLoading ? '...' : timingGaps.length.toLocaleString()} tone={timingGaps.length ? 'warn' : 'ok'}/>
        <KPI label="Absolute delta" value={stockLoading ? '...' : fmtQty(absoluteDelta)} tone={absoluteDelta ? 'warn' : 'ok'}/>
        <KPI label="Open exceptions" value={exceptionsLoading ? '...' : exceptions.length.toLocaleString()} tone={exceptions.length ? 'critical' : 'ok'}/>
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
          <Card title="Live stock comparison" subtitle="Material · plant · storage location · IM · WM · delta" eyebrow="imwm_stock_comparison_v" tight>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>Material</th><th>Plant</th><th>Storage</th><th className="num">IM qty</th><th className="num">WM qty</th><th className="num">Delta</th><th className="num">Value</th><th>Status</th></tr></thead>
                <tbody>
                  {stock.slice(0, 50).map((row, index) => (
                    <tr key={`${row.material_id}-${row.plant_id}-${row.storage_loc}-${index}`} className={row.mismatch_kind === 'true' ? 'is-risk-red' : ''}>
                      <td><div style={{ fontSize: 12 }}>{String(row.material_name ?? row.material_id ?? '—')}</div><div className="muted mono small">{String(row.material_id ?? '—')}</div></td>
                      <td><div style={{ fontSize: 12 }}>{String(row.plant_name ?? row.plant_id ?? '—')}</div><div className="muted mono small">{String(row.plant_id ?? '—')}</div></td>
                      <td><div style={{ fontSize: 12 }}>{String(row.storage_loc_name ?? row.storage_loc ?? '—')}</div><div className="muted mono small">{String(row.storage_loc ?? '—')}</div></td>
                      <td className="num">{fmtQty(row.im_total_qty)} {String(row.uom ?? '')}</td>
                      <td className="num">{fmtQty(row.wm_total_qty)} {String(row.uom ?? '')}</td>
                      <td className={`num ${num(row.delta_qty) !== 0 ? 'bold amber' : ''}`}>{fmtQty(row.delta_qty)}</td>
                      <td className="num">{fmtMoney(row.inventory_value_eur)}</td>
                      <td><Pill tone={mismatchTone(row.mismatch_kind)}>{String(row.mismatch_kind ?? '—')}</Pill></td>
                    </tr>
                  ))}
                  {!stockLoading && stock.length === 0 && <tr><td colSpan={8} className="muted small">No live IM/WM stock rows are available for this plant.</td></tr>}
                  {stockError && <tr><td colSpan={8} className="red small">Unable to load live IM/WM stock rows: {stockError}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'exceptions' && (
        <Card title="Exception queue" subtitle={`${sev4.length} severity-4 rows require immediate attention`} eyebrow="imwm_exceptions_v" tight>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>Type</th><th className="num">Severity</th><th className="num">SLA</th><th>Material</th><th>Plant</th><th>Storage</th><th>Detail</th><th>Detected</th></tr></thead>
              <tbody>
                {exceptions.slice(0, 80).map((row, index) => (
                  <tr key={`${row.exception_type}-${row.material_id}-${index}`} className={num(row.severity) >= 4 ? 'is-risk-red' : ''}>
                    <td><Pill tone={severityTone(row.severity)}>{String(row.exception_type ?? '—')}</Pill></td>
                    <td className="num">{String(row.severity ?? '—')}</td>
                    <td className="num">{String(row.sla_hours ?? '—')}h</td>
                    <td className="mono small">{String(row.material_id ?? '—')}</td>
                    <td className="mono small">{String(row.plant_id ?? '—')}</td>
                    <td className="mono small">{String(row.storage_loc ?? '—')}</td>
                    <td style={{ fontSize: 12 }}>{String(row.detail_text ?? '—')}</td>
                    <td className="mono small">{String(row.detected_date ?? '—')}</td>
                  </tr>
                ))}
                {!exceptionsLoading && exceptions.length === 0 && <tr><td colSpan={8} className="muted small">No live IM/WM exceptions are available for this plant.</td></tr>}
                {exceptionsError && <tr><td colSpan={8} className="red small">Unable to load live IM/WM exceptions: {exceptionsError}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'movements' && (
        <Card title="Recent movements" subtitle="Material document activity from the last 24 hours" eyebrow="imwm_movements_v" tight>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>Document</th><th>Posting date</th><th>Movement</th><th>Material</th><th>Plant</th><th>Storage</th><th className="num">Qty</th><th>User</th></tr></thead>
              <tbody>
                {movements.slice(0, 80).map((row, index) => (
                  <tr key={`${row.document_number}-${index}`}>
                    <td className="mono small">{String(row.document_number ?? '—')}</td>
                    <td className="mono small">{String(row.posting_date ?? '—')} {String(row.posting_time ?? '')}</td>
                    <td><Pill tone="sage">{String(row.movement_type ?? '—')}</Pill></td>
                    <td><div style={{ fontSize: 12 }}>{String(row.material_name ?? row.material_id ?? '—')}</div><div className="muted mono small">{String(row.material_id ?? '—')}</div></td>
                    <td className="mono small">{String(row.plant_id ?? '—')}</td>
                    <td className="mono small">{String(row.storage_loc ?? '—')}</td>
                    <td className="num">{fmtQty(row.quantity)} {String(row.uom ?? '')}</td>
                    <td className="mono small">{String(row.username ?? '—')}</td>
                  </tr>
                ))}
                {!movementsLoading && movements.length === 0 && <tr><td colSpan={8} className="muted small">No live IM/WM movements are available for this plant.</td></tr>}
                {movementsError && <tr><td colSpan={8} className="red small">Unable to load live IM/WM movements: {movementsError}</td></tr>}
              </tbody>
            </table>
          </div>
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
