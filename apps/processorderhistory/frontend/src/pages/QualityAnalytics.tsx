// @ts-nocheck
/**
 * Quality Analytics — one export:
 *   - QualityAnalyticsPage: full insights page — daily/hourly trend charts
 *     plus an interactive breakdown by characteristic, material, process order,
 *     or judgement. Includes a CSV download tab.
 *
 * Tracks inspection quality performance: accepted vs rejected results,
 * right-first-time (RFT) rate, and the materials or characteristics driving
 * quality losses.
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { I, TopBar } from '../ui'
import { fetchQualityAnalytics, type QualityData, type QualityResultRow, type QualityDaySeries, type QualityHourSeries } from '../api/quality'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the current date in ISO 8601 format (YYYY-MM-DD). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Formats a UTC-epoch millisecond timestamp as a short day label.
 * @param ms - Epoch milliseconds.
 */
function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/**
 * Formats a UTC-epoch millisecond timestamp as an HH:MM time label.
 * @param ms - Epoch milliseconds.
 */
function fmtHour(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Returns a human-readable label for a date range.
 * @param dateFrom - Start date string (YYYY-MM-DD).
 * @param dateTo   - End date string (YYYY-MM-DD).
 */
function periodLabel(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

/**
 * Bar chart showing accepted + rejected inspection results per day over the
 * last 30 days. Bar colour encodes the RFT percentage for that day.
 * @param data - Array of daily quality series data points.
 */
function QualityTrendChart30d({ data }: { data: QualityDaySeries[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxTotal = Math.max(...data.map(d => d.accepted + d.rejected), 1)
  const maxV = maxTotal * 1.1
  const barW = innerW / data.length - 2

  return (
    <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0, 0.5, 1].map((p, i) => {
        const y = padT + innerH - p * innerH
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{Math.round(maxV * p)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const total = d.accepted + d.rejected
        if (total === 0) return null
        const x = padL + i * (innerW / data.length) + 1
        const h = (total / maxV) * innerH
        const y = padT + innerH - h
        const isToday = i === data.length - 1
        let fill: string
        if (d.rft_pct == null) return null
        if (d.rft_pct >= 98) fill = '#1F6E4A'
        else if (d.rft_pct >= 95) fill = '#B45309'
        else fill = '#DC2626'
        return (
          <rect key={i} x={x} y={y} width={barW} height={h}
            fill={fill}
            opacity={isToday ? 1 : 0.85} rx="1" />
        )
      })}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtDay(data[0].date)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtDay(data[Math.floor(data.length / 2)].date)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">today</text>
    </svg>
  )
}

/**
 * Line-area chart showing the right-first-time percentage per hour over the
 * last 24 hours. Handles null RFT values by rendering contiguous non-null
 * segments separately. Draws a reference line at 98%.
 * @param data - Array of hourly quality series data points.
 */
function QualityTrendChart24h({ data }: { data: QualityHourSeries[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 32, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const bottom = padT + innerH

  /** Maps a value in [0,100] to an SVG y-coordinate (Y axis fixed 0–100%). */
  const xFor = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * innerW
  const yFor = (v: number) => padT + innerH - (v / 100) * innerH

  // Build contiguous non-null runs for segment rendering
  const runs: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  data.forEach((d, i) => {
    if (d.rft_pct !== null) {
      current.push({ x: xFor(i), y: yFor(d.rft_pct) })
    } else {
      if (current.length > 0) {
        runs.push(current)
        current = []
      }
    }
  })
  if (current.length > 0) runs.push(current)

  // Y-axis reference line position for 98%
  const refY = yFor(98)

  return (
    <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Horizontal gridlines at 0%, 50%, 100% */}
      {['0%', '50%', '100%'].map((lbl, i) => {
        const y = padT + innerH - (i * 0.5) * innerH
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{lbl}</text>
          </g>
        )
      })}

      {/* 98% reference line */}
      <line
        x1={padL} y1={refY} x2={W - padR} y2={refY}
        stroke="#1F6E4A" strokeDasharray="3 3" strokeWidth="1.5" opacity="0.7"
      />
      <text x={padL - 4} y={refY + 3} textAnchor="end" className="pour-axis-lbl" fill="#1F6E4A">98%</text>

      {/* Segment area fills and lines */}
      {runs.map((pts, si) => {
        if (pts.length === 0) return null
        const linePath = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        const first = pts[0]
        const last = pts[pts.length - 1]
        const areaPath = linePath + ` L${last.x.toFixed(1)} ${bottom.toFixed(1)} L${first.x.toFixed(1)} ${bottom.toFixed(1)} Z`
        return (
          <g key={si}>
            <path d={areaPath} fill="var(--valentia-slate)" opacity="0.1" />
            <path d={linePath} fill="none" stroke="var(--valentia-slate)" strokeWidth="2" />
          </g>
        )
      })}

      {/* Dots for every non-null point */}
      {data.map((d, i) =>
        d.rft_pct !== null
          ? <circle key={i} cx={xFor(i)} cy={yFor(d.rft_pct)} r="2.2" fill="var(--valentia-slate)" />
          : null
      )}

      {/* X-axis labels */}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtHour(data[0].hour)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtHour(data[Math.floor(data.length / 2)].hour)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">now</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// QualityAnalyticsBreakdown (internal)
// ---------------------------------------------------------------------------

interface BreakdownProps {
  rows: QualityResultRow[]
  prior7d: QualityResultRow[]
  dateFrom: string
  dateTo: string
}

/** Maps group-by dimension keys to their row key-extraction functions. */
const QUALITY_KEY_FNS: Record<string, (r: QualityResultRow) => string> = {
  characteristic: r => r.characteristic_description ?? r.characteristic_id,
  material:       r => r.material_name ?? r.material_id,
  process_order:  r => r.process_order ?? '—',
  judgement:      r => r.judgement === 'A' ? 'Accepted' : 'Rejected',
}

/** Human-readable column header label for each group-by dimension. */
const QUALITY_DIM_LABEL: Record<string, string> = {
  characteristic: 'Characteristic',
  material:       'Material',
  process_order:  'Process Order',
  judgement:      'Judgement',
}

/**
 * Interactive breakdown panel for quality results. Supports group-by dimension
 * selection, sort order, table/card view toggle, and CSV download.
 *
 * @param rows     - Filtered inspection result rows for the selected period.
 * @param prior7d  - Rows from the prior 7-day comparison period.
 * @param dateFrom - Start of the selected date range (YYYY-MM-DD).
 * @param dateTo   - End of the selected date range (YYYY-MM-DD).
 */
function QualityAnalyticsBreakdown({ rows, prior7d, dateFrom, dateTo }: BreakdownProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'download'>('analysis')
  const [groupBy, setGroupBy] = useState('characteristic')
  const [sortBy, setSortBy] = useState('rejected')
  const [cardView, setCardView] = useState(false)

  const keyFn = QUALITY_KEY_FNS[groupBy] ?? ((r: QualityResultRow) => r.characteristic_id)
  const isPoOrder = groupBy === 'process_order'

  /** Aggregated groups with accepted/rejected counts, order count, and reject %. */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; accepted: number; rejected: number; orderCount: number; _orders: Set<string> }>()
    rows.forEach(r => {
      const k = keyFn(r)
      if (!map.has(k)) map.set(k, { key: k, accepted: 0, rejected: 0, orderCount: 0, _orders: new Set() })
      const e = map.get(k)!
      if (r.judgement === 'A') e.accepted++; else e.rejected++
      e._orders.add(r.process_order)
    })
    let arr = Array.from(map.values()).map(e => ({
      key: e.key,
      accepted: e.accepted,
      rejected: e.rejected,
      orderCount: e._orders.size,
      total: e.accepted + e.rejected,
      rejectPct: e.accepted + e.rejected > 0 ? (e.rejected / (e.accepted + e.rejected)) * 100 : 0,
    }))
    if (sortBy === 'rejected') arr.sort((a, b) => b.rejected - a.rejected || b.rejectPct - a.rejectPct)
    else arr.sort((a, b) => a.key.localeCompare(b.key))
    if (isPoOrder) arr = arr.slice(0, 30)
    return arr
  }, [rows, groupBy, sortBy, keyFn, isPoOrder])

  /**
   * Per-group average daily rejected count from the prior 7-day window.
   * Not computed for process-order group-by (too granular for trending).
   */
  const prior7dAvg = useMemo(() => {
    if (isPoOrder || !prior7d.length) return new Map<string, number>()
    const daily = new Map<string, Map<string, number>>()
    prior7d.forEach(r => {
      const k = keyFn(r)
      const day = new Date(r.result_date_ms).toISOString().slice(0, 10)
      if (!daily.has(k)) daily.set(k, new Map())
      const dm = daily.get(k)!
      if (r.judgement === 'R') dm.set(day, (dm.get(day) ?? 0) + 1)
    })
    const result = new Map<string, number>()
    daily.forEach((dm, k) => {
      const total = Array.from(dm.values()).reduce((a, b) => a + b, 0)
      if (dm.size > 0) result.set(k, total / dm.size)
    })
    return result
  }, [prior7d, groupBy, keyFn, isPoOrder])

  const totalResults = groups.reduce((a, g) => a + g.total, 0)
  const maxRejected = Math.max(1, ...groups.map(g => g.rejected))
  const avgRejectPct = groups.length ? groups.reduce((a, g) => a + g.rejectPct, 0) / groups.length : 0

  /** Triggers a CSV download of all raw inspection result rows in the current filter. */
  function handleDownload() {
    const header = [
      'Timestamp', 'Process Order', 'Inspection Lot', 'Material ID', 'Material Name',
      'Characteristic ID', 'Characteristic Description', 'Sample ID', 'Specification',
      'Quantitative Result', 'Qualitative Result', 'UOM', 'Judgement',
      'Usage Decision Code', 'Valuation Code', 'Quality Score',
    ]
    const csvRows = rows.map(r => [
      new Date(r.result_date_ms).toISOString(),
      r.process_order ?? '',
      r.inspection_lot_id ?? '',
      r.material_id,
      r.material_name,
      r.characteristic_id,
      r.characteristic_description ?? '',
      r.sample_id ?? '',
      r.specification ?? '',
      r.quantitative_result != null ? r.quantitative_result.toString() : '',
      r.qualitative_result ?? '',
      r.uom ?? '',
      r.judgement,
      r.usage_decision_code ?? '',
      r.valuation_code ?? '',
      r.quality_score != null ? r.quality_score.toString() : '',
    ])
    const csv = [header, ...csvRows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quality_${dateFrom}_${dateTo}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.shield}
          <span>Breakdown</span>
          <span className="pa-meta">
            {totalResults.toLocaleString()} results · {periodLabel(dateFrom, dateTo)}
            {activeTab === 'analysis' && ` · grouped by ${QUALITY_DIM_LABEL[groupBy].toLowerCase()}`}
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
              {[
                { k: 'characteristic', label: 'Characteristic' },
                { k: 'material', label: 'Material' },
                { k: 'process_order', label: 'Process Order' },
                { k: 'judgement', label: 'Judgement' },
              ].map(o => (
                <button key={o.k} className={groupBy === o.k ? 'active' : ''} onClick={() => setGroupBy(o.k)}>{o.label}</button>
              ))}
            </div>
            <div className="pa-seg">
              <span className="pa-seg-l">Sort</span>
              <button className={sortBy === 'rejected' ? 'active' : ''} onClick={() => setSortBy('rejected')}>Rejected</button>
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
          <div className="pa-bars-head">
            <div>{QUALITY_DIM_LABEL[groupBy]}</div>
            <div className="right">Rejected</div>
            <div></div>
            <div className="right">Reject %</div>
            <div className="right">vs avg</div>
          </div>
          {groups.map((g, i) => {
            const vsAvg = avgRejectPct ? ((g.rejectPct - avgRejectPct) / avgRejectPct) * 100 : 0
            // Higher reject % is bad: positive deviation → neg class; negative deviation → pos class
            const vsCls = Math.abs(vsAvg) < 8 ? 'neut' : vsAvg > 0 ? 'neg' : 'pos'
            return (
              <div key={g.key} className="pa-row">
                <div className="pa-row-name">
                  <span className="pa-row-rank mono">#{i + 1}</span>
                  <span>{g.key}</span>
                </div>
                <div className="pa-row-count mono" style={{ color: g.rejected > 0 ? '#DC2626' : undefined }}>
                  {g.rejected.toLocaleString()}
                </div>
                <div className="pa-row-bar">
                  <div className="pa-row-fill" style={{ width: `${(g.rejected / maxRejected) * 100}%`, background: '#DC262640' }} />
                </div>
                <div className="pa-row-kg mono">{g.rejectPct.toFixed(1)}%</div>
                <div className={`pa-row-vs mono ${vsCls}`}>
                  {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
                </div>
              </div>
            )
          })}
          {groups.length === 0 && <div className="pa-empty">No results match.</div>}
        </div>
      )}

      {activeTab === 'analysis' && cardView && (
        <div className="pa-card-grid">
          {groups.map(g => {
            const dayAvg = prior7dAvg.get(g.key) ?? null
            return (
              <div key={g.key} className="pa-card">
                <div className="pa-card-name" title={g.key}>{g.key}</div>
                <div className="pa-card-count mono">{g.accepted.toLocaleString()}</div>
                <div className="pa-card-count-label">
                  accepted · {g.rejected.toLocaleString()} rejected ({g.rejectPct.toFixed(1)}%)
                </div>
                {!isPoOrder && (
                  <div className="pa-card-avg">
                    {dayAvg != null
                      ? <><strong>{dayAvg.toFixed(1)}</strong> rejected / day avg · prior 7d</>
                      : <span style={{ color: 'var(--ink-300)' }}>No prior 7d data</span>
                    }
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <div style={{ padding: '24px', color: 'var(--ink-400)', fontSize: 12 }}>No results match.</div>}
        </div>
      )}

      {activeTab === 'download' && (
        <div className="pa-download">
          <div className="pad-info">
            <span className="pad-rows mono">{rows.length.toLocaleString()} rows</span>
            <span>inspection results · {periodLabel(dateFrom, dateTo)}</span>
          </div>
          <div className="pad-cols">
            Columns: Timestamp, Process Order, Inspection Lot, Material ID, Material Name, Characteristic ID, Characteristic Description, Sample ID, Specification, Quantitative Result, Qualitative Result, UOM, Judgement, Usage Decision Code, Valuation Code, Quality Score
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
// QualityAnalyticsPage — full page export
// ---------------------------------------------------------------------------

/**
 * Full-page quality analytics view. Fetches inspection result data for the
 * selected date range, renders KPI summary tiles, 30-day and 24-hour trend
 * charts, and an interactive breakdown panel with download capability.
 *
 * Material filter is applied client-side against the server-provided row set.
 * All `useMemo` hooks are called unconditionally before any early returns.
 */
export function QualityAnalyticsPage() {
  const { t } = useT()
  const [materialFilter, setMaterialFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [pageData, setPageData] = useState<QualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchQualityAnalytics({ date_from: dateFrom, date_to: dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  const trail = [t.operations || 'Operations', t.sectionInsights || 'Insights', 'Quality analytics']

  // All useMemo hooks MUST be called unconditionally before any early returns
  const allRows = pageData?.rows ?? []
  const materials = pageData?.materials ?? []

  /** Inspection result rows filtered to the selected material (or all). */
  const rows = useMemo(
    () => materialFilter === 'ALL' ? allRows : allRows.filter(r => r.material_name === materialFilter || r.material_id === materialFilter),
    [allRows, materialFilter],
  )

  /** Prior 7-day rows filtered to the selected material (or all). */
  const prior7d = useMemo(() => {
    let list = pageData?.prior7d ?? []
    if (materialFilter !== 'ALL') list = list.filter(r => r.material_name === materialFilter || r.material_id === materialFilter)
    return list
  }, [pageData, materialFilter])

  const daily30d = pageData?.daily30d ?? []
  const hourly24h = pageData?.hourly24h ?? []

  // KPI derivations — plain computations, no hooks
  const accepted = rows.filter(r => r.judgement === 'A').length
  const rejected = rows.filter(r => r.judgement === 'R').length
  const total = accepted + rejected
  const rftPct = total > 0 ? (accepted / total) * 100 : null
  const rejectPct = total > 0 ? (rejected / total) * 100 : null
  const qualityTone = rftPct == null ? '' : rftPct >= 98 ? 'good' : rftPct >= 95 ? 'ok' : 'bad'

  /** Average RFT % over the 30-day daily series (null if no data). */
  const avg30dRft = (() => {
    const pts = daily30d.filter(d => d.rft_pct !== null)
    if (!pts.length) return null
    return (pts.reduce((a, d) => a + d.rft_pct!, 0) / pts.length).toFixed(1)
  })()

  /** Lowest single-hour RFT % in the 24-hour series (null if no data). */
  const minHourRft = (() => {
    const pts = hourly24h.filter(h => h.rft_pct !== null)
    if (!pts.length) return null
    return Math.min(...pts.map(h => h.rft_pct!)).toFixed(1)
  })()

  const todayStr = todayISO()

  if (error) {
    return (
      <>
        <TopBar trail={trail} />
        <div className="page-error">Failed to load quality analytics: {error}</div>
      </>
    )
  }

  return (
    <>
      <TopBar trail={trail} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.shield}<span>Insights</span></div>
          <h1 className="page-title">Quality analytics</h1>
          <p className="page-sub">
            Track inspection quality performance across the plant. Monitor accepted vs rejected results,
            right-first-time rate, and the materials or characteristics driving quality losses.
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
          {materials.length > 0 && (
            <div className="pss-filter">
              <label className="pss-flbl">{I.package}<span>Material</span></label>
              <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}>
                <option value="ALL">All materials · {materials.length}</option>
                {materials.map(mat => <option key={mat} value={mat}>{mat}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Loading quality analytics…
        </div>
      )}

      {!loading && (
        <div className="pa-page-body">
          <div className="pour-grid pour-grid-page">
            {/* Card 1: Accepted results */}
            <div className={`pour-kpi tone-actual ${qualityTone}`}>
              <div className="pk-l">{I.check}<span>Accepted results</span></div>
              <div className="pk-v mono">{accepted.toLocaleString()}</div>
              <div className="pk-sub">
                {rftPct != null && (
                  <span className={`pk-delta ${qualityTone === 'good' ? 'pos' : qualityTone === 'ok' ? 'neut' : 'neg'}`}>
                    {rftPct.toFixed(1)}% RFT
                  </span>
                )}
                {' '}inspection results accepted
              </div>
              <div className="pk-bar">
                <div className="pk-fill act" style={{ width: `${Math.min(100, rftPct ?? 0)}%` }} />
              </div>
            </div>

            {/* Card 2: Right first time */}
            <div className="pour-kpi tone-target">
              <div className="pk-l">{I.trending}<span>Right first time</span></div>
              <div className="pk-v mono">{rftPct != null ? rftPct.toFixed(1) + '%' : '—'}</div>
              <div className="pk-sub">{total.toLocaleString()} results inspected</div>
            </div>

            {/* Card 3: Rejected results */}
            <div className="pour-kpi tone-planned">
              <div className="pk-l">{I.alert}<span>Rejected results</span></div>
              <div className="pk-v mono">{rejected.toLocaleString()}</div>
              {rejectPct != null && (
                <div className="pk-sub">
                  <span className={`pk-delta ${rejectPct > 5 ? 'neg' : rejectPct > 2 ? 'neut' : 'pos'}`}>
                    {rejectPct.toFixed(1)}% reject rate
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pour-trends">
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Quality per day · last 30 days</span>
                {avg30dRft != null && <span className="ptc-meta mono">avg RFT {avg30dRft}%</span>}
              </div>
              <QualityTrendChart30d data={daily30d} />
            </div>
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Right first time · last 24 hours</span>
                {minHourRft != null && <span className="ptc-meta mono">lowest {minHourRft}%</span>}
              </div>
              <QualityTrendChart24h data={hourly24h} />
            </div>
          </div>

          <QualityAnalyticsBreakdown rows={rows} prior7d={prior7d} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      )}
    </>
  )
}
