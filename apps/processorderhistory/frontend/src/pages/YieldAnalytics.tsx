// @ts-nocheck
/**
 * Yield Analytics page — three internal components plus one page export:
 *   - YieldTrendChart30d   : SVG bar chart, daily avg yield % over last 30 days
 *   - YieldTrendChart24h   : SVG area/line chart, hourly avg yield % over last 24h
 *   - YieldBreakdown       : tabbed breakdown table + card view + CSV download
 *   - YieldAnalyticsPage   : full page — KPIs, trend charts, breakdown
 *
 * Mirrors PourAnalytics.tsx patterns exactly, adapted for yield data derived
 * from MT-101 (received) and MT-261 (issued) movements.
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { I, TopBar } from '../ui'
import { fetchYieldAnalytics, type YieldData, type YieldOrder, type YieldDaySeries, type YieldHourSeries } from '../api/yield'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as an ISO-8601 date string (YYYY-MM-DD). */
function todayISO(): string { return new Date().toISOString().slice(0, 10) }

/** Formats an epoch-ms timestamp as a short GB date, e.g. "29 Apr". */
function fmtDay(ms: number) { return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }

/** Formats an epoch-ms timestamp as HH:MM (24-hour, no seconds). */
function fmtHour(ms: number) { return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) }

/**
 * Returns a human-readable period label.
 * When dateFrom equals dateTo, returns just that date; otherwise "a → b".
 */
function periodLabel(a: string, b: string) { return a === b ? a : `${a} → ${b}` }

// ---------------------------------------------------------------------------
// YieldTrendChart30d — SVG bar chart of daily avg yield % over 30 days
// ---------------------------------------------------------------------------

/**
 * Renders a 30-day daily yield % bar chart as an inline SVG.
 *
 * @param data        - Array of YieldDaySeries entries (one per day).
 * @param targetYield - The plant yield target percentage; rendered as a dashed reference line.
 */
function YieldTrendChart30d({ data, targetYield }: { data: YieldDaySeries[]; targetYield: number }) {
  if (!data?.length) return null

  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const nonNullVals = data.map(d => d.avg_yield_pct).filter((v): v is number => v != null)
  const minV = nonNullVals.length ? Math.max(0, Math.min(...nonNullVals) - 5) : 0
  const maxV = 100

  const barW = innerW / data.length - 2

  // Dashed reference line Y position for targetYield
  const refY = padT + innerH - ((targetYield - minV) / (maxV - minV)) * innerH

  return (
    <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Gridlines at minV, midpoint, maxV */}
      {[minV, (minV + maxV) / 2, maxV].map((v, i) => {
        const y = padT + innerH - ((v - minV) / (maxV - minV)) * innerH
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{v.toFixed(0)}%</text>
          </g>
        )
      })}

      {/* Target yield reference line */}
      <line
        x1={padL} y1={refY} x2={W - padR} y2={refY}
        stroke="var(--valentia-slate)" strokeDasharray="3 3" opacity="0.6"
      />
      <text x={W - padR - 2} y={refY - 3} textAnchor="end" className="pour-axis-lbl">{targetYield}%</text>

      {/* Bars */}
      {data.map((d, i) => {
        if (d.avg_yield_pct == null) return null
        const x = padL + i * (innerW / data.length) + 1
        const h = ((d.avg_yield_pct - minV) / (maxV - minV)) * innerH
        const y = padT + innerH - h
        const isLast = i === data.length - 1
        const fill = d.avg_yield_pct >= targetYield
          ? '#1F6E4A'
          : d.avg_yield_pct >= 85
            ? 'var(--sunrise)'
            : '#C04A1F'
        return (
          <rect key={i} x={x} y={y} width={barW} height={h}
            fill={fill} opacity={isLast ? 1 : 0.82} rx="1" />
        )
      })}

      {/* X-axis labels: first, middle, today */}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtDay(data[0].date)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtDay(data[Math.floor(data.length / 2)].date)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">today</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// YieldTrendChart24h — SVG area/line chart of hourly avg yield % over 24h
// ---------------------------------------------------------------------------

/**
 * Renders a 24-hour hourly yield % area+line chart as an inline SVG.
 * Null values cause path gaps; only non-null points are connected.
 *
 * @param data        - Array of YieldHourSeries entries (one per hour).
 * @param targetYield - The plant yield target percentage; rendered as a dashed reference line.
 */
function YieldTrendChart24h({ data, targetYield }: { data: YieldHourSeries[]; targetYield: number }) {
  if (!data?.length) return null

  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const nonNullVals = data.map(d => d.avg_yield_pct).filter((v): v is number => v != null)
  const minV = nonNullVals.length ? Math.max(0, Math.min(...nonNullVals) - 5) : 0
  const maxV = 100

  const xFor = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * innerW
  const yFor = (v: number) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH

  // Dashed reference line Y position for targetYield
  const refY = padT + innerH - ((targetYield - minV) / (maxV - minV)) * innerH

  // Build path segments, breaking at null values
  const segments: string[] = []
  let currentSegment: string[] = []
  data.forEach((d, i) => {
    if (d.avg_yield_pct == null) {
      if (currentSegment.length) {
        segments.push(currentSegment.join(' '))
        currentSegment = []
      }
    } else {
      const x = xFor(i).toFixed(1)
      const y = yFor(d.avg_yield_pct).toFixed(1)
      currentSegment.push(currentSegment.length === 0 ? `M${x} ${y}` : `L${x} ${y}`)
    }
  })
  if (currentSegment.length) segments.push(currentSegment.join(' '))

  const linePath = segments.join(' ')

  // Area fill only for continuous non-null runs
  const areaSegments: string[] = []
  let areaStart: { i: number; x: string } | null = null
  let areaPoints: string[] = []
  data.forEach((d, i) => {
    if (d.avg_yield_pct != null) {
      if (!areaStart) { areaStart = { i, x: xFor(i).toFixed(1) } }
      areaPoints.push(`${xFor(i).toFixed(1)} ${yFor(d.avg_yield_pct).toFixed(1)}`)
    } else {
      if (areaStart && areaPoints.length > 1) {
        const lastX = xFor(i - 1).toFixed(1)
        areaSegments.push(`M${areaPoints[0]} ${areaPoints.slice(1).map(p => `L${p}`).join(' ')} L${lastX} ${(padT + innerH).toFixed(1)} L${areaStart.x} ${(padT + innerH).toFixed(1)} Z`)
      }
      areaStart = null
      areaPoints = []
    }
  })
  if (areaStart && areaPoints.length > 1) {
    const lastX = xFor(data.length - 1).toFixed(1)
    areaSegments.push(`M${areaPoints[0]} ${areaPoints.slice(1).map(p => `L${p}`).join(' ')} L${lastX} ${(padT + innerH).toFixed(1)} L${areaStart.x} ${(padT + innerH).toFixed(1)} Z`)
  }

  return (
    <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Gridlines at minV, midpoint, maxV */}
      {[minV, (minV + maxV) / 2, maxV].map((v, i) => {
        const y = padT + innerH - ((v - minV) / (maxV - minV)) * innerH
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{v.toFixed(0)}%</text>
          </g>
        )
      })}

      {/* Target yield reference line */}
      <line
        x1={padL} y1={refY} x2={W - padR} y2={refY}
        stroke="var(--valentia-slate)" strokeDasharray="3 3" opacity="0.6"
      />
      <text x={W - padR - 2} y={refY - 3} textAnchor="end" className="pour-axis-lbl">{targetYield}%</text>

      {/* Area fills */}
      {areaSegments.map((d, i) => (
        <path key={i} d={d} fill="var(--valentia-slate)" opacity="0.10" />
      ))}

      {/* Lines */}
      {linePath && (
        <path d={linePath} fill="none" stroke="var(--valentia-slate)" strokeWidth="2" />
      )}

      {/* Dots — only for non-null values */}
      {data.map((d, i) => {
        if (d.avg_yield_pct == null) return null
        return (
          <circle key={i} cx={xFor(i)} cy={yFor(d.avg_yield_pct)} r="2.2" fill="var(--valentia-slate)" />
        )
      })}

      {/* X-axis labels: first hour, midpoint, now */}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtHour(data[0].hour)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtHour(data[Math.floor(data.length / 2)].hour)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">now</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// YieldBreakdown — tabbed breakdown table/cards + CSV download
// ---------------------------------------------------------------------------

interface YieldBreakdownProps {
  orders: YieldOrder[]
  prior7d: YieldOrder[]
  dateFrom: string
  dateTo: string
  targetYield: number
}

/**
 * Tabbed breakdown of yield data.
 * Analysis tab: group by material or process order; table or card view.
 * Download tab: export raw order list as CSV.
 *
 * @param orders      - Filtered YieldOrder list for the selected period.
 * @param prior7d     - Prior 7-day YieldOrder list for trend comparison.
 * @param dateFrom    - Start of selected date range (YYYY-MM-DD).
 * @param dateTo      - End of selected date range (YYYY-MM-DD).
 * @param targetYield - Plant yield target percentage.
 */
function YieldBreakdown({ orders, prior7d, dateFrom, dateTo, targetYield }: YieldBreakdownProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'download'>('analysis')
  const [groupBy, setGroupBy] = useState<'material' | 'process_order'>('material')
  const [sortBy, setSortBy] = useState<'yield' | 'name'>('yield')
  const [cardView, setCardView] = useState(false)

  const isPoOrder = groupBy === 'process_order'
  const dimLabel = groupBy === 'material' ? 'Material' : 'Process Order'

  /** Key function extracts the grouping key from a YieldOrder. */
  const keyFn = (o: YieldOrder) =>
    groupBy === 'material' ? (o.material_name || o.material_id) : o.process_order_id

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; qtyIssued: number; qtyReceived: number; orderCount: number }>()
    orders.forEach(o => {
      const k = keyFn(o)
      if (!map.has(k)) map.set(k, { key: k, qtyIssued: 0, qtyReceived: 0, orderCount: 0 })
      const e = map.get(k)!
      e.qtyIssued += o.qty_issued_kg
      e.qtyReceived += o.qty_received_kg
      e.orderCount++
    })
    let arr = Array.from(map.values()).map(g => ({
      ...g,
      yieldPct: g.qtyIssued > 0 ? (g.qtyReceived / g.qtyIssued) * 100 : null,
      lossKg: g.qtyIssued > 0 ? g.qtyIssued - g.qtyReceived : null,
    }))
    if (sortBy === 'yield') {
      // Worst yield first; nulls go last
      arr.sort((a, b) => {
        if (a.yieldPct == null && b.yieldPct == null) return 0
        if (a.yieldPct == null) return 1
        if (b.yieldPct == null) return -1
        return a.yieldPct - b.yieldPct
      })
    } else {
      arr.sort((a, b) => a.key.localeCompare(b.key))
    }
    if (isPoOrder) arr = arr.slice(0, 50)
    return arr
  }, [orders, groupBy, sortBy])

  /** Prior 7-day average yield per group key (material name), using sum-of-received / sum-of-issued. */
  const prior7dAvg = useMemo(() => {
    if (isPoOrder || !prior7d.length) return new Map<string, number>()
    const map = new Map<string, { issued: number; received: number }>()
    prior7d.forEach(o => {
      const k = groupBy === 'material' ? (o.material_name || o.material_id) : o.process_order_id
      if (!map.has(k)) map.set(k, { issued: 0, received: 0 })
      const e = map.get(k)!
      e.issued += o.qty_issued_kg
      e.received += o.qty_received_kg
    })
    const result = new Map<string, number>()
    map.forEach((v, k) => {
      if (v.issued > 0) result.set(k, (v.received / v.issued) * 100)
    })
    return result
  }, [prior7d, groupBy])

  const validGroups = groups.filter(g => g.yieldPct != null)
  const avgYield = validGroups.length
    ? validGroups.reduce((a, g) => a + g.yieldPct, 0) / validGroups.length
    : 0

  /** Returns inline color style for a yield percentage value. */
  function yieldColor(v: number | null): string {
    if (v == null) return 'inherit'
    if (v >= targetYield) return '#1F6E4A'
    if (v >= 85) return 'var(--sunrise)'
    return '#8B2900'
  }

  function handleDownload() {
    const header = ['Process Order', 'Material ID', 'Material Name', 'Plant', 'Issued (kg)', 'Received (kg)', 'Yield (%)', 'Loss (kg)', 'Date']
    const rows = orders.map(o => [
      o.process_order_id,
      o.material_id,
      o.material_name,
      o.plant_id,
      o.qty_issued_kg.toFixed(3),
      o.qty_received_kg.toFixed(3),
      o.yield_pct != null ? o.yield_pct.toFixed(2) : '',
      o.loss_kg != null ? o.loss_kg.toFixed(3) : '',
      new Date(o.order_date_ms).toISOString().slice(0, 10),
    ])
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yield_${dateFrom}_${dateTo}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Grid template for the extra columns (7 columns vs PourAnalytics's 5)
  const gridCols = '1fr 80px 1fr 90px 90px 80px 70px'

  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.trending}
          <span>Breakdown</span>
          <span className="pa-meta">
            {groups.length} groups · {periodLabel(dateFrom, dateTo)} · grouped by {dimLabel.toLowerCase()}
          </span>
        </div>
        <div className="pa-tabs">
          <button
            className={activeTab === 'analysis' ? 'active' : ''}
            onClick={() => setActiveTab('analysis')}
          >Analysis</button>
          <button
            className={activeTab === 'download' ? 'active' : ''}
            onClick={() => setActiveTab('download')}
          >{I.download}<span>Download</span></button>
        </div>
        {activeTab === 'analysis' && (
          <div className="pa-controls">
            <div className="pa-seg">
              <span className="pa-seg-l">Group by</span>
              <button className={groupBy === 'material' ? 'active' : ''} onClick={() => setGroupBy('material')}>Material</button>
              <button className={groupBy === 'process_order' ? 'active' : ''} onClick={() => setGroupBy('process_order')}>Process Order</button>
            </div>
            <div className="pa-seg">
              <span className="pa-seg-l">Sort</span>
              <button className={sortBy === 'yield' ? 'active' : ''} onClick={() => setSortBy('yield')}>Worst yield first</button>
              <button className={sortBy === 'name' ? 'active' : ''} onClick={() => setSortBy('name')}>Name</button>
            </div>
            <div className="pa-seg">
              <span className="pa-seg-l">View</span>
              <button className={!cardView ? 'active' : ''} onClick={() => setCardView(false)}>Table</button>
              <button className={cardView ? 'active' : ''} onClick={() => setCardView(true)}>Cards</button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'analysis' && !cardView && (
        <div className="pa-bars">
          <div className="pa-bars-head" style={{ gridTemplateColumns: gridCols }}>
            <div>{dimLabel}</div>
            <div className="right">Yield %</div>
            <div></div>
            <div className="right">Issued (kg)</div>
            <div className="right">Received (kg)</div>
            <div className="right">Loss (kg)</div>
            <div className="right">vs avg</div>
          </div>
          {groups.map((g, i) => {
            const vsAvg = g.yieldPct != null ? g.yieldPct - avgYield : null
            const vsCls = vsAvg == null ? 'neut' : vsAvg > 2 ? 'pos' : vsAvg < -2 ? 'neg' : 'neut'
            const color = yieldColor(g.yieldPct)
            return (
              <div key={g.key} className="pa-row" style={{ gridTemplateColumns: gridCols }}>
                <div className="pa-row-name">
                  <span className="pa-row-rank mono">#{i + 1}</span>
                  <span>{g.key}</span>
                </div>
                <div className="pa-row-count mono" style={{ color, fontWeight: 600 }}>
                  {g.yieldPct != null ? g.yieldPct.toFixed(1) + '%' : '—'}
                </div>
                <div className="pa-row-bar">
                  <div
                    className="pa-row-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, g.yieldPct ?? 0))}%`,
                      background: color,
                    }}
                  />
                </div>
                <div className="pa-row-kg mono">{(g.qtyIssued / 1000).toFixed(1)} t</div>
                <div className="pa-row-kg mono">{(g.qtyReceived / 1000).toFixed(1)} t</div>
                <div className="pa-row-kg mono">
                  {g.lossKg != null ? (g.lossKg / 1000).toFixed(1) + ' t' : '—'}
                </div>
                <div className={`pa-row-vs mono ${vsCls}`}>
                  {vsAvg == null ? '—' : (vsAvg >= 0 ? '+' : '') + vsAvg.toFixed(1) + '%'}
                </div>
              </div>
            )
          })}
          {groups.length === 0 && <div className="pa-empty">No yield data matches.</div>}
        </div>
      )}

      {activeTab === 'analysis' && cardView && (
        <div className="pa-card-grid">
          {groups.map(g => {
            const dayAvg = prior7dAvg.get(g.key) ?? null
            const color = yieldColor(g.yieldPct)
            return (
              <div key={g.key} className="pa-card">
                <div className="pa-card-name" title={g.key}>{g.key}</div>
                <div className="pa-card-count mono" style={{ color }}>
                  {g.yieldPct != null ? g.yieldPct.toFixed(1) + '%' : '—'}
                </div>
                <div className="pa-card-count-label">
                  {g.orderCount} orders · {(g.qtyReceived / 1000).toFixed(1)} t received
                </div>
                {!isPoOrder && (
                  <div className="pa-card-avg">
                    {dayAvg != null
                      ? <><strong>{dayAvg.toFixed(1)}%</strong> yield avg · prior 7d</>
                      : <span style={{ color: 'var(--ink-300)' }}>No prior 7d data</span>
                    }
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && (
            <div style={{ padding: '24px', color: 'var(--ink-400)', fontSize: 12 }}>No yield data matches.</div>
          )}
        </div>
      )}

      {activeTab === 'download' && (
        <div className="pa-download">
          <div className="pad-info">
            <span className="pad-rows mono">{orders.length.toLocaleString()} rows</span>
            <span>yield orders · {periodLabel(dateFrom, dateTo)}</span>
          </div>
          <div className="pad-cols">
            Columns: Process Order, Material ID, Material Name, Plant, Issued (kg), Received (kg), Yield (%), Loss (kg), Date
          </div>
          <button className="btn primary" onClick={handleDownload}>
            {I.download}<span>Download CSV</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// YieldAnalyticsPage — full page export
// ---------------------------------------------------------------------------

/**
 * Full-page yield analytics view.
 * Fetches yield data on mount and when date range changes.
 * Displays KPI cards, 30-day and 24-hour trend charts, and a breakdown table.
 */
export function YieldAnalyticsPage() {
  const { t } = useT()
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [materialFilter, setMaterialFilter] = useState('ALL')
  const [pageData, setPageData] = useState<YieldData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchYieldAnalytics({ date_from: dateFrom, date_to: dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  const orders = pageData?.orders ?? []
  const prior7d = pageData?.prior7d ?? []
  const targetYield = pageData?.target_yield_pct ?? 95
  const daily30d = pageData?.daily30d ?? []
  const hourly24h = pageData?.hourly24h ?? []
  const allMaterials = pageData?.materials ?? []

  const filteredOrders = useMemo(
    () => materialFilter === 'ALL' ? orders : orders.filter(o => o.material_name === materialFilter || o.material_id === materialFilter),
    [orders, materialFilter]
  )
  const filteredPrior7d = useMemo(
    () => materialFilter === 'ALL' ? prior7d : prior7d.filter(o => o.material_name === materialFilter || o.material_id === materialFilter),
    [prior7d, materialFilter]
  )

  const validOrders = filteredOrders.filter(o => o.yield_pct != null)
  const avgYield = validOrders.length
    ? validOrders.reduce((a, o) => a + o.yield_pct, 0) / validOrders.length
    : null
  const totalLossT = filteredOrders.reduce((a, o) => a + (o.loss_kg ?? 0), 0) / 1000
  const yieldTone = avgYield == null ? '' : avgYield >= targetYield ? 'good' : avgYield >= 85 ? 'ok' : 'bad'

  const todayStr = todayISO()

  if (error) {
    return (
      <>
        <TopBar trail={[t.operations || 'Operations', t.sectionInsights || 'Insights', 'Yield analytics']} />
        <div className="page-error">Failed to load yield analytics: {error}</div>
      </>
    )
  }

  // 30-day average for chart label
  const daily30dNonNull = daily30d.filter(d => d.avg_yield_pct != null)
  const daily30dAvgLabel = daily30dNonNull.length
    ? `avg ${daily30dNonNull.reduce((a, d, _, arr) => a + d.avg_yield_pct / arr.length, 0).toFixed(1)}% / day`
    : null

  // 24h peak for chart label
  const hourly24hNonNull = hourly24h.filter(d => d.avg_yield_pct != null)
  const peakHourPct = hourly24hNonNull.length
    ? Math.max(...hourly24hNonNull.map(d => d.avg_yield_pct))
    : null

  return (
    <>
      <TopBar trail={[t.operations || 'Operations', t.sectionInsights || 'Insights', 'Yield analytics']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.trending}<span>Insights</span></div>
          <h1 className="page-title">Yield analytics</h1>
          <p className="page-sub">
            Track process order yield against the quality threshold across the plant.
            Drill in by material or order to identify where losses are occurring.
          </p>
        </div>
        <div className="page-head-actions">
          <div className="date-pick">
            {I.calendar}
            <input
              type="date"
              value={dateFrom}
              max={dateTo || todayStr}
              onChange={e => setDateFrom(e.target.value)}
              style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, cursor: 'pointer' }}
            />
            <span className="sep">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayStr}
              onChange={e => setDateTo(e.target.value)}
              style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, cursor: 'pointer' }}
            />
          </div>
          {allMaterials.length > 0 && (
            <div className="pss-filter">
              <label className="pss-flbl">{I.flask}<span>Material</span></label>
              <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}>
                <option value="ALL">All materials · {allMaterials.length}</option>
                {allMaterials.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Loading yield analytics…
        </div>
      )}

      {!loading && (
        <div className="pa-page-body">
          <div className="pour-grid pour-grid-page">
            <div className="pour-kpi tone-target">
              <div className="pk-l">{I.alert}<span>Target yield</span></div>
              <div className="pk-v mono">{targetYield.toFixed(0)}%</div>
              <div className="pk-sub">yield · quality threshold</div>
            </div>
            <div className="pour-kpi tone-planned">
              <div className="pk-l">{I.flask}<span>Average yield</span></div>
              <div className="pk-v mono">{avgYield != null ? avgYield.toFixed(1) + '%' : '—'}</div>
              <div className="pk-sub">{validOrders.length} orders · selected period</div>
            </div>
            <div className={`pour-kpi tone-actual ${yieldTone}`}>
              <div className="pk-l">{I.trending}<span>Total loss</span></div>
              <div className="pk-v mono">{totalLossT.toFixed(1)} t</div>
              <div className="pk-sub">
                <span className={`pk-delta ${avgYield == null ? 'neut' : avgYield >= targetYield ? 'pos' : avgYield >= 85 ? 'neut' : 'neg'}`}>
                  {avgYield != null ? avgYield.toFixed(1) + '% avg yield' : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="pour-trends">
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Yield % per day · last 30 days</span>
                {daily30dAvgLabel && (
                  <span className="ptc-meta mono">{daily30dAvgLabel}</span>
                )}
              </div>
              <YieldTrendChart30d data={daily30d} targetYield={targetYield} />
            </div>
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Yield % per hour · last 24 hours</span>
                <span className="ptc-meta mono">
                  {peakHourPct != null ? `peak ${peakHourPct.toFixed(1)}%` : '–'}
                </span>
              </div>
              <YieldTrendChart24h data={hourly24h} targetYield={targetYield} />
            </div>
          </div>

          <YieldBreakdown
            orders={filteredOrders}
            prior7d={filteredPrior7d}
            dateFrom={dateFrom}
            dateTo={dateTo}
            targetYield={targetYield}
          />
        </div>
      )}
    </>
  )
}
