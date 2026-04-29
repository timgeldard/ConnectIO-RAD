/**
 * Pour Performance — three exports:
 *   - PourKpiCards     : 3 KPI tiles (Target/Planned/Actual) — used on Order List
 *   - PourLineFilter   : a compact <select> chip — placed in page-head-actions
 *   - PourAnalyticsPage: full insights page — trend charts + analytics breakdown
 *
 * The Insights page owns its own fetch so it can apply a date range filter.
 * PourKpiCards uses a shared module-level cache for the rolling 24h view.
 *
 * Pours = goods issues (movement type 261). One pour = one decant
 * (tank/IBC/tote → process).
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { I, TopBar } from '../ui'
import { fetchPoursAnalytics, type PoursData, type PourEvent, type DaySeries, type HourSeries } from '../api/pours'

const DAILY_TARGET = 350

// ---------------------------------------------------------------------------
// Shared hook: fetch + cache analytics payload (last-24h, no date range)
// ---------------------------------------------------------------------------

let _cached: PoursData | null = null

function usePoursData(): { data: PoursData | null; error: string | null } {
  const [data, setData] = useState<PoursData | null>(_cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (_cached) return
    fetchPoursAnalytics()
      .then(d => { _cached = d; setData(d) })
      .catch(e => setError(String(e)))
  }, [])

  return { data, error }
}

// ---------------------------------------------------------------------------
// Filtered KPIs derived from data + lineFilter
// ---------------------------------------------------------------------------

interface FilteredPours {
  events: PourEvent[]
  actual: number
  planned: number | null
  planVsActualPct: number
  daily30d: DaySeries[]
  hourly24h: HourSeries[]
}

function useFilteredPours(data: PoursData | null, lineFilter: string): FilteredPours | null {
  return useMemo(() => {
    if (!data) return null

    const events = lineFilter === 'ALL'
      ? data.events
      : data.events.filter(e => e.line_id === lineFilter)

    const actual = events.length
    const planned = data.planned_24h
    const planVsActualPct = planned ? Math.round((actual / planned) * 100) : 0

    const daily30d = data.daily30d[lineFilter] ?? data.daily30d['ALL'] ?? []
    const hourly24h = data.hourly24h[lineFilter] ?? data.hourly24h['ALL'] ?? []

    return { events, actual, planned, planVsActualPct, daily30d, hourly24h }
  }, [data, lineFilter])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtHour(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function daysInRange(dateFrom: string, dateTo: string): number {
  const from = new Date(dateFrom).getTime()
  const to = new Date(dateTo).getTime()
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1)
}

function periodLabel(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

function TrendChart30d({ data }: { data: DaySeries[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxActual = Math.max(...data.map(d => d.actual), 1)
  const maxV = maxActual * 1.1
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
        const x = padL + i * (innerW / data.length) + 1
        const h = (d.actual / maxV) * innerH
        const y = padT + innerH - h
        const isToday = i === data.length - 1
        return (
          <rect key={i} x={x} y={y} width={barW} height={h}
            fill={isToday ? 'var(--valentia-slate)' : '#1F6E4A'}
            opacity={isToday ? 1 : 0.78} rx="1" />
        )
      })}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtDay(data[0].date)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtDay(data[Math.floor(data.length / 2)].date)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">today</text>
    </svg>
  )
}

function TrendChart24h({ data }: { data: HourSeries[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxActual = Math.max(...data.map(d => d.actual), 1)
  const maxV = maxActual * 1.15
  const xFor = (i: number) => padL + (i / (data.length - 1)) * innerW
  const yFor = (v: number) => padT + innerH - (v / maxV) * innerH
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(d.actual).toFixed(1)}`).join(' ')
  const area = path + ` L${xFor(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L${xFor(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

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
      <path d={area} fill="var(--valentia-slate)" opacity="0.12" />
      <path d={path} fill="none" stroke="var(--valentia-slate)" strokeWidth="2" />
      {data.map((d, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(d.actual)} r="2.2" fill="var(--valentia-slate)" />
      ))}
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtHour(data[0].hour)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtHour(data[Math.floor(data.length / 2)].hour)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">now</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// PourLineFilter — exported for parent-controlled usage
// ---------------------------------------------------------------------------

interface PourLineFilterProps {
  value: string
  onChange: (next: string) => void
  lines: string[]
}

export function PourLineFilter({ value, onChange, lines }: PourLineFilterProps) {
  return (
    <div className="pss-filter">
      <label className="pss-flbl">{I.factory}<span>Line</span></label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="ALL">All lines · {lines.length}</option>
        {lines.map(id => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PourKpiCards — exported for Order List header usage
// ---------------------------------------------------------------------------

interface PourKpiCardsProps {
  lineFilter: string
}

export function PourKpiCards({ lineFilter }: PourKpiCardsProps) {
  const { data } = usePoursData()
  const f = useFilteredPours(data, 'ALL')

  if (!f || !data) {
    return (
      <div className="pour-kpi-strip">
        <div className="pour-kpi-strip-head">
          <span className="pss-eyebrow">{I.package}<span>Pour performance · last 24h</span></span>
        </div>
        <div className="pour-grid">
          {[0, 1, 2].map(i => <div key={i} className="pour-kpi" style={{ opacity: 0.4 }} />)}
        </div>
      </div>
    )
  }

  const { actual, planned } = f

  return (
    <div className="pour-kpi-strip">
      <div className="pour-kpi-strip-head">
        <span className="pss-eyebrow">{I.package}<span>Pour performance · last 24h</span></span>
        <span className="pss-meta mono">
          {new Date(data.now_ms).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <div style={{ flex: 1 }} />
        <a className="pss-link" onClick={() => (window as any).__navigateToPourAnalytics?.()}>
          View pour analytics {I.arrowR}
        </a>
      </div>
      <div className="pour-grid">
        <div className="pour-kpi tone-target">
          <div className="pk-l">{I.alert}<span>Target / 24h</span></div>
          <div className="pk-v mono">{DAILY_TARGET.toLocaleString()}</div>
          <div className="pk-sub">pours · capacity ceiling</div>
        </div>
        <div className="pour-kpi tone-planned">
          <div className="pk-l">{I.calendar}<span>Planned / 24h</span></div>
          <div className="pk-v mono">{planned != null ? planned.toLocaleString() : '—'}</div>
          <div className="pk-sub">scheduled goods-issues</div>
        </div>
        <div className="pour-kpi tone-actual">
          <div className="pk-l">{I.trending}<span>Actual / 24h</span></div>
          <div className="pk-v mono">{actual.toLocaleString()}</div>
          <div className="pk-sub">pours recorded</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PourAnalytics breakdown table (internal)
// ---------------------------------------------------------------------------

interface BreakdownProps {
  events: PourEvent[]
  prior7d: PourEvent[]
  dateFrom: string
  dateTo: string
}

const KEY_FNS: Record<string, (p: PourEvent) => string> = {
  operator:       p => p.operator ?? '—',
  shift:          p => p.shift != null ? `Shift ${p.shift}` : '—',
  source:         p => p.source_area ?? '—',
  source_type:    p => p.source_type ?? '—',
  process_order:  p => p.process_order ?? '—',
}

const DIM_LABEL: Record<string, string> = {
  operator:      'Operator',
  shift:         'Shift',
  source:        'Source area',
  source_type:   'Source type',
  process_order: 'Process Order',
}

function PourAnalyticsBreakdown({ events, prior7d, dateFrom, dateTo }: BreakdownProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'download'>('analysis')
  const [groupBy, setGroupBy] = useState('operator')
  const [sortBy, setSortBy] = useState('count')
  const [cardView, setCardView] = useState(false)

  const keyFn = KEY_FNS[groupBy] ?? ((p: PourEvent) => p.line_id)
  const isPoOrder = groupBy === 'process_order'

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; count: number; kg: number }>()
    events.forEach(p => {
      const k = keyFn(p)
      if (!map.has(k)) map.set(k, { key: k, count: 0, kg: 0 })
      const e = map.get(k)!
      e.count++
      e.kg += p.quantity
    })
    let arr = Array.from(map.values())
    if (sortBy === 'count') arr.sort((a, b) => b.count - a.count)
    else arr.sort((a, b) => a.key.localeCompare(b.key))
    if (isPoOrder) arr = arr.slice(0, 30)
    return arr
  }, [events, groupBy, sortBy, keyFn, isPoOrder])

  const prior7dAvg = useMemo(() => {
    if (isPoOrder || !prior7d.length) return new Map<string, number>()
    const daily = new Map<string, Map<string, number>>()
    prior7d.forEach(p => {
      const k = keyFn(p)
      const day = new Date(p.ts_ms).toISOString().slice(0, 10)
      if (!daily.has(k)) daily.set(k, new Map())
      const dm = daily.get(k)!
      dm.set(day, (dm.get(day) ?? 0) + 1)
    })
    const result = new Map<string, number>()
    daily.forEach((dm, k) => {
      const activeDays = dm.size
      if (activeDays > 0) {
        const total = Array.from(dm.values()).reduce((a, b) => a + b, 0)
        result.set(k, total / activeDays)
      }
    })
    return result
  }, [prior7d, groupBy, keyFn, isPoOrder])

  const total = groups.reduce((a, g) => a + g.count, 0)
  const max = Math.max(1, ...groups.map(g => g.count))
  const avg = groups.length ? total / groups.length : 0

  const dimLabel = DIM_LABEL

  function handleDownload() {
    const header = ['Timestamp', 'Process Order', 'Line', 'Operator', 'Shift', 'Source Type', 'Source Area', 'Quantity (kg)', 'UOM']
    const rows = events.map(e => [
      new Date(e.ts_ms).toISOString(),
      e.process_order ?? '',
      e.line_id,
      e.operator ?? '',
      e.shift ?? '',
      e.source_type ?? '',
      e.source_area ?? '',
      e.quantity.toFixed(3),
      e.uom ?? '',
    ])
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pours_${dateFrom}_${dateTo}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.trending}
          <span>Breakdown</span>
          <span className="pa-meta">
            {total.toLocaleString()} pours · {periodLabel(dateFrom, dateTo)}
            {activeTab === 'analysis' && ` · grouped by ${dimLabel[groupBy].toLowerCase()}`}
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
                { k: 'operator', label: 'Operator' },
                { k: 'shift', label: 'Shift' },
                { k: 'source_type', label: 'Source type' },
                { k: 'source', label: 'Source area' },
                { k: 'process_order', label: 'Process Order' },
              ].map(o => (
                <button key={o.k} className={groupBy === o.k ? 'active' : ''} onClick={() => setGroupBy(o.k)}>{o.label}</button>
              ))}
            </div>
            <div className="pa-seg">
              <span className="pa-seg-l">Sort</span>
              <button className={sortBy === 'count' ? 'active' : ''} onClick={() => setSortBy('count')}>Count</button>
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
            <div>{dimLabel[groupBy]}</div>
            <div className="right">Pours</div>
            <div></div>
            <div className="right">Volume</div>
            <div className="right">vs avg</div>
          </div>
          {groups.map((g, i) => {
            const pct = (g.count / max) * 100
            const vsAvg = avg ? ((g.count - avg) / avg) * 100 : 0
            const vsCls = Math.abs(vsAvg) < 8 ? 'neut' : vsAvg > 0 ? 'pos' : 'neg'
            return (
              <div key={g.key} className="pa-row">
                <div className="pa-row-name">
                  <span className="pa-row-rank mono">#{i + 1}</span>
                  <span>{g.key}</span>
                </div>
                <div className="pa-row-count mono">{g.count.toLocaleString()}</div>
                <div className="pa-row-bar">
                  <div className="pa-row-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="pa-row-kg mono">{(g.kg / 1000).toFixed(1)} t</div>
                <div className={`pa-row-vs mono ${vsCls}`}>
                  {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
                </div>
              </div>
            )
          })}
          {groups.length === 0 && <div className="pa-empty">No pours match.</div>}
        </div>
      )}

      {activeTab === 'analysis' && cardView && (
        <div className="pa-card-grid">
          {groups.map(g => {
            const dayAvg = prior7dAvg.get(g.key) ?? null
            return (
              <div key={g.key} className="pa-card">
                <div className="pa-card-name" title={g.key}>{g.key}</div>
                <div className="pa-card-count mono">{g.count.toLocaleString()}</div>
                <div className="pa-card-count-label">pours · {g.kg.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
                {!isPoOrder && (
                  <div className="pa-card-avg">
                    {dayAvg != null
                      ? <><strong>{dayAvg.toFixed(1)}</strong> / day avg · prior 7d</>
                      : <span style={{ color: 'var(--ink-300)' }}>No prior 7d data</span>
                    }
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <div style={{ padding: '24px', color: 'var(--ink-400)', fontSize: 12 }}>No pours match.</div>}
        </div>
      )}

      {activeTab === 'download' && (
        <div className="pa-download">
          <div className="pad-info">
            <span className="pad-rows mono">{events.length.toLocaleString()} rows</span>
            <span>pour events · {periodLabel(dateFrom, dateTo)}</span>
          </div>
          <div className="pad-cols">
            Columns: Timestamp, Process Order, Line, Operator, Shift, Source Type, Source Area, Quantity (kg), UOM
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
// PourAnalyticsPage — full page export
// ---------------------------------------------------------------------------

export function PourAnalyticsPage() {
  const { t } = useT()
  const [sourceTypeFilter, setSourceTypeFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [pageData, setPageData] = useState<PoursData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPoursAnalytics({ dateFrom, dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  const f = useFilteredPours(pageData, 'ALL')

  if (error) {
    return (
      <>
        <TopBar trail={[t.operations || 'Operations', t.sectionInsights || 'Insights', 'Pour analytics']} />
        <div className="page-error">Failed to load pour analytics: {error}</div>
      </>
    )
  }

  const days = daysInRange(dateFrom, dateTo)
  const planned = f?.planned ?? null
  const daily30d = f?.daily30d ?? []
  const hourly24h = f?.hourly24h ?? []

  const allEvents = f?.events ?? []
  const sourceTypes = useMemo(
    () => [...new Set(allEvents.map(e => e.source_type).filter((v): v is string => v != null))].sort(),
    [allEvents],
  )
  const events = useMemo(
    () => sourceTypeFilter === 'ALL' ? allEvents : allEvents.filter(e => e.source_type === sourceTypeFilter),
    [allEvents, sourceTypeFilter],
  )
  const prior7d = useMemo(() => {
    let list = pageData?.prior7d ?? []
    if (sourceTypeFilter !== 'ALL') list = list.filter(e => e.source_type === sourceTypeFilter)
    return list
  }, [pageData, sourceTypeFilter])

  const actual = events.length
  const target = DAILY_TARGET * days
  const planVsActualPct = planned != null && planned > 0 ? Math.round((actual / planned) * 100) : null

  const todayStr = todayISO()

  return (
    <>
      <TopBar trail={[t.operations || 'Operations', t.sectionInsights || 'Insights', 'Pour analytics']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.trending}<span>Insights</span></div>
          <h1 className="page-title">Pour analytics</h1>
          <p className="page-sub">
            Track goods-issue pours against target across all lines. Drill in by operator, shift,
            line, source area, or process order to see who's pouring what — and where bottlenecks form.
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
          {sourceTypes.length > 0 && (
            <div className="pss-filter">
              <label className="pss-flbl">{I.package}<span>Source type</span></label>
              <select value={sourceTypeFilter} onChange={e => setSourceTypeFilter(e.target.value)}>
                <option value="ALL">All types · {sourceTypes.length}</option>
                {sourceTypes.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Loading pour analytics…
        </div>
      )}

      {!loading && (
        <div className="pa-page-body">
          <div className="pour-grid pour-grid-page">
            <div className="pour-kpi tone-target">
              <div className="pk-l">{I.alert}<span>Target</span></div>
              <div className="pk-v mono">{target.toLocaleString()}</div>
              <div className="pk-sub">
                {days === 1 ? `pours · ${DAILY_TARGET}/day` : `pours · ${DAILY_TARGET}/day × ${days} days`}
              </div>
            </div>
            <div className="pour-kpi tone-planned">
              <div className="pk-l">{I.calendar}<span>Planned</span></div>
              <div className="pk-v mono">{planned != null ? planned.toLocaleString() : '—'}</div>
              <div className="pk-sub">scheduled goods-issues</div>
            </div>
            <div className={`pour-kpi tone-actual ${planVsActualPct == null ? '' : planVsActualPct >= 95 ? 'good' : planVsActualPct >= 80 ? 'ok' : 'bad'}`}>
              <div className="pk-l">{I.trending}<span>Actual</span></div>
              <div className="pk-v mono">{actual.toLocaleString()}</div>
              {planVsActualPct != null && (
                <div className="pk-sub">
                  <span className={`pk-delta ${planVsActualPct >= 95 ? 'pos' : planVsActualPct >= 85 ? 'neut' : 'neg'}`}>
                    {planVsActualPct}% of plan
                  </span>
                </div>
              )}
              <div className="pk-bar">
                <div className="pk-fill act" style={{ width: `${Math.min(100, planned != null && planned > 0 ? (actual / planned) * 100 : 0)}%` }} />
              </div>
            </div>
          </div>

          <div className="pour-trends">
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Pours per day · last 30 days</span>
                {daily30d.length > 0 && (
                  <span className="ptc-meta mono">
                    avg {Math.round(daily30d.reduce((a, d) => a + d.actual, 0) / daily30d.length)} / day
                  </span>
                )}
              </div>
              <TrendChart30d data={daily30d} />
            </div>
            <div className="pour-trend-card">
              <div className="ptc-head">
                <span className="ptc-title">Pours per hour · last 24 hours</span>
                {hourly24h.length > 0 && (
                  <span className="ptc-meta mono">
                    peak {Math.max(...hourly24h.map(h => h.actual))} / hr
                  </span>
                )}
              </div>
              <TrendChart24h data={hourly24h} />
            </div>
          </div>

          <PourAnalyticsBreakdown events={events} prior7d={prior7d} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      )}
    </>
  )
}
