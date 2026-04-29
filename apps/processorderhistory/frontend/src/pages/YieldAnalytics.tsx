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
// YieldTrendChart — unified 24h / 7d / 30d toggle with hover tooltip
// ---------------------------------------------------------------------------

/** Yield chart with range toggle and hover tooltip.
 * Renders a bar chart coloured by yield vs target for 7 d / 30 d and an
 * area+line chart for 24 h (hourly). */
function YieldTrendChart({
  daily30d,
  hourly24h,
  targetYield,
  defaultRange = '30d',
}) {
  const [range, setRange] = useState(defaultRange)
  const [tooltip, setTooltip] = useState(null)

  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const isHourly = range === '24h'
  const barData = range === '7d' ? daily30d.slice(-7) : daily30d

  // Y-axis: fixed 0–100% range for yield
  const minV = 0, maxV = 100
  const barSlot = innerW / Math.max(barData.length, 1)
  const barW = barSlot - 2

  const lineX = (i) => padL + (i / Math.max(hourly24h.length - 1, 1)) * innerW
  const lineY = (v) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH
  const barY = (v) => v == null ? padT + innerH : padT + innerH - ((v - minV) / (maxV - minV)) * innerH
  const barH = (v) => v == null ? 0 : Math.max(((v - minV) / (maxV - minV)) * innerH, 0)

  // Line chart path (segments break at null values)
  const lineSegments = []; let seg = []
  hourly24h.forEach((d, i) => {
    if (d.avg_yield_pct == null) { if (seg.length) { lineSegments.push(seg.join(' ')); seg = [] } }
    else { seg.push(`${seg.length === 0 ? 'M' : 'L'}${lineX(i).toFixed(1)} ${lineY(d.avg_yield_pct).toFixed(1)}`) }
  })
  if (seg.length) lineSegments.push(seg.join(' '))
  const linePath = lineSegments.join(' ')

  // Area fill segments
  const areaSegs = []; let aStart = null; let aPts = []
  hourly24h.forEach((d, i) => {
    if (d.avg_yield_pct != null) {
      if (!aStart) aStart = { x: lineX(i).toFixed(1) }
      aPts.push(`${lineX(i).toFixed(1)} ${lineY(d.avg_yield_pct).toFixed(1)}`)
    } else {
      if (aStart && aPts.length > 1) {
        const lx = lineX(i - 1).toFixed(1), bot = (padT + innerH).toFixed(1)
        areaSegs.push(`M${aPts[0]} ${aPts.slice(1).map(p => `L${p}`).join(' ')} L${lx} ${bot} L${aStart.x} ${bot} Z`)
      }
      aStart = null; aPts = []
    }
  })
  if (aStart && aPts.length > 1) {
    const lx = lineX(hourly24h.length - 1).toFixed(1), bot = (padT + innerH).toFixed(1)
    areaSegs.push(`M${aPts[0]} ${aPts.slice(1).map(p => `L${p}`).join(' ')} L${lx} ${bot} L${aStart.x} ${bot} Z`)
  }

  const refY = padT + innerH - ((targetYield - minV) / (maxV - minV)) * innerH

  const nonNullBar = barData.filter(d => d.avg_yield_pct != null)
  const nonNullLine = hourly24h.filter(d => d.avg_yield_pct != null)
  const metaLabel = isHourly
    ? nonNullLine.length > 0 ? `peak ${Math.max(...nonNullLine.map(d => d.avg_yield_pct)).toFixed(1)}%` : null
    : nonNullBar.length > 0 ? `avg ${(nonNullBar.reduce((a, d) => a + d.avg_yield_pct, 0) / nonNullBar.length).toFixed(1)}% / day` : null

  const TW = 86, TH = 28
  const ttx = tooltip ? Math.max(padL + TW / 2, Math.min(W - padR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < padT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0

  return (
    <div className="pour-trend-card">
      <div className="ptc-head">
        <span className="ptc-title">
          Yield % · {isHourly ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days'}
        </span>
        {metaLabel && <span className="ptc-meta mono">{metaLabel}</span>}
        <div className="chart-range-toggle">
          {['24h', '7d', '30d'].map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => { setRange(r); setTooltip(null) }}>{r}</button>
          ))}
        </div>
      </div>

      <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseLeave={() => setTooltip(null)}>

        {[minV, (minV + maxV) / 2, maxV].map((v, i) => {
          const y = padT + innerH - ((v - minV) / (maxV - minV)) * innerH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
              <text x={padL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{v.toFixed(0)}%</text>
            </g>
          )
        })}
        <line x1={padL} y1={refY} x2={W - padR} y2={refY} stroke="var(--valentia-slate)" strokeDasharray="3 3" opacity="0.6" />
        <text x={W - padR - 2} y={refY - 3} textAnchor="end" className="pour-axis-lbl">{targetYield}%</text>

        {isHourly && hourly24h.length > 0 && (
          <>
            {areaSegs.map((d, i) => <path key={i} d={d} fill="var(--valentia-slate)" opacity="0.10" />)}
            {linePath && <path d={linePath} fill="none" stroke="var(--valentia-slate)" strokeWidth="2" />}
            {hourly24h.map((d, i) => d.avg_yield_pct != null && (
              <circle key={i} cx={lineX(i)} cy={lineY(d.avg_yield_pct)} r="2.2" fill="var(--valentia-slate)" />
            ))}
            <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtHour(hourly24h[0].hour)}</text>
            <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtHour(hourly24h[Math.floor(hourly24h.length / 2)].hour)}</text>
            <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">now</text>
            <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent"
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - padL) / innerW) * (hourly24h.length - 1))))
                const d = hourly24h[idx]
                setTooltip({ x: lineX(idx), y: lineY(d.avg_yield_pct ?? 0), label: fmtHour(d.hour), value: d.avg_yield_pct != null ? d.avg_yield_pct.toFixed(1) + '%' : '—' })
              }}
            />
          </>
        )}

        {!isHourly && barData.length > 0 && (
          <>
            {barData.map((d, i) => {
              if (d.avg_yield_pct == null) return null
              const bx = padL + i * barSlot + 1
              const fill = d.avg_yield_pct >= targetYield ? '#1F6E4A' : d.avg_yield_pct >= 85 ? 'var(--sunrise)' : '#C04A1F'
              return (
                <rect key={i} x={bx} y={barY(d.avg_yield_pct)} width={barW} height={barH(d.avg_yield_pct)}
                  fill={fill} opacity={i === barData.length - 1 ? 1 : 0.82} rx="1" />
              )
            })}
            <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtDay(barData[0].date)}</text>
            <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtDay(barData[Math.floor(barData.length / 2)].date)}</text>
            <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">today</text>
            <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent"
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - padL) / barSlot)))
                const d = barData[idx]
                setTooltip({ x: padL + idx * barSlot + 1 + barW / 2, y: barY(d.avg_yield_pct), label: fmtDay(d.date), value: d.avg_yield_pct != null ? d.avg_yield_pct.toFixed(1) + '%' : '—' })
              }}
            />
          </>
        )}

        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={ttx - TW / 2} y={tty - TH} width={TW} height={TH} rx={3} fill="var(--ink-900)" opacity={0.88} />
            <text x={ttx} y={tty - TH + 11} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)">{tooltip.label}</text>
            <text x={ttx} y={tty - TH + 23} textAnchor="middle" fontSize={11} fontWeight="600" fill="white">{tooltip.value}</text>
          </g>
        )}
      </svg>
    </div>
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
        <div className="pa-bars" style={{ gridTemplateColumns: gridCols }}>
          <div className="pa-bars-head">
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
              <div key={g.key} className="pa-row">
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
                <div className="pa-row-kg mono">{g.qtyIssued.toFixed(1)} kg</div>
                <div className="pa-row-kg mono">{g.qtyReceived.toFixed(1)} kg</div>
                <div className="pa-row-kg mono">
                  {g.lossKg != null ? g.lossKg.toFixed(1) + ' kg' : '—'}
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
                  {g.orderCount} orders · {g.qtyReceived.toFixed(1)} kg received
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
  const totalLossKg = filteredOrders.reduce((a, o) => a + (o.loss_kg ?? 0), 0)
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
              <div className="pk-v mono">{totalLossKg.toFixed(1)} kg</div>
              <div className="pk-sub">
                <span className={`pk-delta ${avgYield == null ? 'neut' : avgYield >= targetYield ? 'pos' : avgYield >= 85 ? 'neut' : 'neg'}`}>
                  {avgYield != null ? avgYield.toFixed(1) + '% avg yield' : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="pour-trends">
            <YieldTrendChart daily30d={daily30d} hourly24h={hourly24h} targetYield={targetYield} defaultRange="30d" />
            <YieldTrendChart daily30d={daily30d} hourly24h={hourly24h} targetYield={targetYield} defaultRange="24h" />
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
