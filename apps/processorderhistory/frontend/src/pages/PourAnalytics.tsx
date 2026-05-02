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
import { TopBar, Icon, Button, type IconName } from '@connectio/shared-ui'
import { fetchPoursAnalytics, type PoursData, type PourEvent, type DaySeries, type HourSeries } from '../api/pours'
import {
  AnalyticsFilterBar,
  AnalyticsCorrelationPanel,
  ContributorsPanel,
  DeltaPill,
  inBucket,
  useAnalyticsFilters,
  type BucketSelection,
} from './analyticsShared'

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
// Chart components — unified PourTrendChart with 24h / 7d / 30d toggle + tooltip
// ---------------------------------------------------------------------------

type Range = '24h' | '7d' | '30d'
interface TooltipData { x: number; y: number; label: string; value: string }

const CW = 560, CH = 110, CL = 28, CR = 6, CT = 6, CB = 16
const IW = CW - CL - CR, IH = CH - CT - CB

/** Pour count chart with range toggle and hover tooltip.
 * Renders a line chart for 24 h (hourly) and a bar chart for 7 d / 30 d (daily). */
function PourTrendChart({
  daily30d,
  hourly24h,
  defaultRange = '30d',
  onSelectBucket,
}: {
  daily30d: DaySeries[]
  hourly24h: HourSeries[]
  defaultRange?: Range
  onSelectBucket?: (selection: BucketSelection) => void
}) {
  const [range, setRange] = useState<Range>(defaultRange)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const isHourly = range === '24h'
  const barData = range === '7d' ? daily30d.slice(-7) : daily30d

  const maxBarV = barData.length ? Math.max(...barData.map(d => d.actual), 1) * 1.1 : 1
  const barSlot = IW / Math.max(barData.length, 1)
  const barW = barSlot - 2

  const maxLineV = hourly24h.length ? Math.max(...hourly24h.map(d => d.actual), 1) * 1.15 : 1
  const lineX = (i: number) => CL + (i / Math.max(hourly24h.length - 1, 1)) * IW
  const lineY = (v: number) => CT + IH - (v / maxLineV) * IH

  const linePath = hourly24h.map((d, i) => `${i === 0 ? 'M' : 'L'}${lineX(i).toFixed(1)} ${lineY(d.actual).toFixed(1)}`).join(' ')
  const areaPath = hourly24h.length > 1
    ? `${linePath} L${lineX(hourly24h.length - 1).toFixed(1)} ${(CT + IH).toFixed(1)} L${lineX(0).toFixed(1)} ${(CT + IH).toFixed(1)} Z`
    : ''

  const metaLabel = isHourly && hourly24h.length > 0
    ? `peak ${Math.max(...hourly24h.map(h => h.actual))} / hr`
    : !isHourly && barData.length > 0
      ? `avg ${Math.round(barData.reduce((a, d) => a + d.actual, 0) / barData.length)} / day`
      : null

  const TW = 80, TH = 28
  const ttx = tooltip ? Math.max(CL + TW / 2, Math.min(CW - CR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < CT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0
  const maxV = isHourly ? maxLineV : maxBarV

  return (
    <div className="pour-trend-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 16 }}>
      <div className="ptc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 13, color: 'var(--text-1)' }}>
          Pours · {isHourly ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days'}
        </span>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 2 }}>
          {(['24h', '7d', '30d'] as Range[]).map(r => (
            <button 
              key={r} 
              className={`btn btn-xs ${range === r ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ height: 20, fontSize: 9, padding: '0 8px' }}
              onClick={() => { setRange(r); setTooltip(null) }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg className="pour-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none"
        onMouseLeave={() => setTooltip(null)} style={{ overflow: 'visible' }}>

        {[0, 0.5, 1].map((p, gi) => {
          const y = CT + IH - p * IH
          return (
            <g key={gi}>
              <line x1={CL} y1={y} x2={CW - CR} y2={y} stroke="var(--line-1)" strokeDasharray="2 3" />
              <text x={CL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-3)">{Math.round(maxV * p)}</text>
            </g>
          )
        })}

        {isHourly && hourly24h.length > 0 && (
          <>
            <path d={areaPath} fill="var(--brand)" opacity="0.08" />
            <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="2" />
            {hourly24h.map((d, i) => (
              <circle key={i} cx={lineX(i)} cy={lineY(d.actual)} r="2.2" fill="var(--brand)" />
            ))}
            <text x={CL} y={CH} fontSize={9} fill="var(--text-3)">{fmtHour(hourly24h[0].hour)}</text>
            <text x={CW - CR} y={CH} textAnchor="end" fontSize={9} fill="var(--text-3)">now</text>
            <rect x={CL} y={CT} width={IW} height={IH} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - CL) / IW) * (hourly24h.length - 1))))
                const d = hourly24h[idx]
                setTooltip({ x: lineX(idx), y: lineY(d.actual), label: fmtHour(d.hour), value: d.actual.toLocaleString() })
              }}
              onClick={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - CL) / IW) * (hourly24h.length - 1))))
                const d = hourly24h[idx]
                onSelectBucket?.({ metric: 'Pours', kind: 'hour', startMs: d.hour, endMs: d.hour + 3_600_000, label: fmtHour(d.hour) })
              }}
            />
          </>
        )}

        {!isHourly && barData.length > 0 && (
          <>
            {barData.map((d, i) => {
              const bx = CL + i * barSlot + 1
              const h = Math.max((d.actual / maxBarV) * IH, 0)
              return (
                <rect key={i} x={bx} y={CT + IH - h} width={barW} height={h}
                  fill={i === barData.length - 1 ? 'var(--brand)' : 'var(--status-ok)'}
                  opacity={i === barData.length - 1 ? 1 : 0.6} rx="1" />
              )
            })}
            <text x={CL} y={CH} fontSize={9} fill="var(--text-3)">{fmtDay(barData[0].date)}</text>
            <text x={CW - CR} y={CH} textAnchor="end" fontSize={9} fill="var(--text-3)">today</text>
            <rect x={CL} y={CT} width={IW} height={IH} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - CL) / barSlot)))
                const d = barData[idx]
                const h = Math.max((d.actual / maxBarV) * IH, 0)
                setTooltip({ x: CL + idx * barSlot + 1 + barW / 2, y: CT + IH - h, label: fmtDay(d.date), value: d.actual.toLocaleString() })
              }}
              onClick={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - CL) / barSlot)))
                const d = barData[idx]
                onSelectBucket?.({ metric: 'Pours', kind: 'day', startMs: d.date, endMs: d.date + 86_400_000, label: fmtDay(d.date) })
              }}
            />
          </>
        )}

        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={ttx - TW / 2} y={tty - TH} width={TW} height={TH} rx={3} fill="var(--text-1)" />
            <text x={ttx} y={tty - TH + 11} textAnchor="middle" fontSize={8} fill="var(--surface-0)" opacity={0.7}>{tooltip.label}</text>
            <text x={ttx} y={tty - TH + 23} textAnchor="middle" fontSize={11} fontWeight="600" fill="var(--surface-0)">{tooltip.value}</text>
          </g>
        )}
      </svg>
    </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)', padding: '4px 12px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text-3)' }}>
        <Icon name="factory" size={13} />
        <span>Line</span>
      </label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', cursor: 'pointer' }}
      >
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

export function PourKpiCards({ lineFilter: _lineFilter }: PourKpiCardsProps) {
  const { data } = usePoursData()
  const f = useFilteredPours(data, 'ALL')

  if (!f || !data) {
    return (
      <div style={{ padding: '24px', opacity: 0.4 }}>Loading pours…</div>
    )
  }

  const { actual, planned } = f

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="package" size={16} />
          <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)' }}>Pour performance · last 24h</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {new Date(data.now_ms).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button 
          className="btn btn-ghost btn-xs" 
          onClick={() => (window as any).__navigateToPourAnalytics?.()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          View pour analytics <Icon name="arrow-right" size={12} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>
            <Icon name="alert-triangle" size={14} />
            <span>Target / 24h</span>
          </div>
          <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{DAILY_TARGET.toLocaleString()}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>
            <Icon name="calendar" size={14} />
            <span>Planned / 24h</span>
          </div>
          <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{planned != null ? planned.toLocaleString() : '—'}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', borderLeft: '4px solid var(--status-ok)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>
            <Icon name="trending-up" size={14} />
            <span>Actual / 24h</span>
          </div>
          <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{actual.toLocaleString()}</div>
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
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--line-1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Icon name="trending-up" size={18} />
            <h2 style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', margin: 0 }}>Breakdown</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {total.toLocaleString()} pours · {periodLabel(dateFrom, dateTo)}
            {activeTab === 'analysis' && ` · grouped by ${dimLabel[groupBy].toLowerCase()}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 4 }}>
          <button className={`btn btn-sm ${activeTab === 'analysis' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('analysis')}>Analysis</button>
          <button className={`btn btn-sm ${activeTab === 'download' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('download')}>
            <Icon name="download" size={14} style={{ marginRight: 6 }} />
            Download
          </button>
        </div>
      </div>

      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>Group by</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['operator', 'shift', 'source_type', 'source', 'process_order'].map(k => (
                <button 
                  key={k} 
                  className={`btn btn-xs ${groupBy === k ? 'btn-secondary' : 'btn-ghost'}`} 
                  onClick={() => setGroupBy(k)}
                >{DIM_LABEL[k]}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>View</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn btn-xs ${!cardView ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setCardView(false)}>Table</button>
              <button className={`btn btn-xs ${cardView ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setCardView(true)}>Cards</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && !cardView && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>{dimLabel[groupBy]}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Pours</th>
                <th style={{ padding: '12px 16px', width: 200 }}></th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Volume (kg)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>vs avg</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                const pct = (g.count / max) * 100
                const vsAvg = avg ? ((g.count - avg) / avg) * 100 : 0
                return (
                  <tr key={g.key} style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8, fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                      <span style={{ fontWeight: 'var(--fw-semibold)' }}>{g.key}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.count.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)' }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.kg.toFixed(1)} kg</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: vsAvg >= 0 ? 'var(--status-ok)' : 'var(--status-risk)' }}>
                      {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'analysis' && cardView && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {groups.map(g => {
            const dayAvg = prior7dAvg.get(g.key) ?? null
            return (
              <div key={g.key} style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.key}>{g.key}</div>
                <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{g.count.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>pours · {g.kg.toLocaleString()} kg</div>
                {!isPoOrder && dayAvg != null && (
                  <div style={{ fontSize: 11, padding: '4px 8px', background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)' }}>
                    <strong>{dayAvg.toFixed(1)}</strong> / day avg · prior 7d
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'download' && (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface-sunken)', borderRadius: 'var(--r-md)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 'var(--fs-18)', fontWeight: 'var(--fw-bold)', marginBottom: 4 }}>{events.length.toLocaleString()} rows</div>
            <div style={{ color: 'var(--text-3)' }}>pour events · {periodLabel(dateFrom, dateTo)}</div>
          </div>
          <Button variant="primary" onClick={handleDownload} icon={<Icon name="download" />}>
            Download CSV
          </Button>
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
  const { filters, setFilters } = useAnalyticsFilters()
  const [sourceTypeFilter, setSourceTypeFilter] = useState('ALL')
  const [pageData, setPageData] = useState<PoursData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<BucketSelection | null>(null)

  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo
  const plantId = filters.plantId === 'ALL' ? undefined : filters.plantId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPoursAnalytics({ plantId, dateFrom, dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [plantId, dateFrom, dateTo])

  const f = useFilteredPours(pageData, 'ALL')

  if (error) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Pour analytics' }]} />
        <div style={{ padding: 48, color: 'var(--status-risk)', textAlign: 'center' }}>Failed to load pour analytics: {error}</div>
      </div>
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
  const priorActual = filters.compare === 'prior7d' ? prior7d.length : null
  const selectedEvents = selection ? events.filter(e => inBucket(e.ts_ms, selection)) : []

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Pour analytics' }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="trending-up" size={14} />
            <span>Insights</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 'var(--fw-bold)', margin: '8px 0 4px', color: 'var(--text-1)' }}>Pour analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Track goods-issue pours against target across all lines. Drill in by operator, shift,
            line, source area, or process order to see who's pouring what — and where bottlenecks form.
          </p>
        </div>
      </div>

      <AnalyticsFilterBar
        filters={filters}
        onChange={patch => { setFilters(patch); setSelection(null) }}
        showMaterial={false}
        showSourceType
        sourceTypes={sourceTypes}
        sourceType={sourceTypeFilter}
        onSourceTypeChange={value => { setSourceTypeFilter(value); setSelection(null) }}
      />

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          Loading pour analytics…
        </div>
      )}

      {!loading && (
        <div style={{ padding: '0 32px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="alert-triangle" size={14} />
                <span>Target</span>
              </div>
              <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{target.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                {days === 1 ? `pours · ${DAILY_TARGET}/day` : `pours · ${DAILY_TARGET}/day × ${days} days`}
              </div>
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="calendar" size={14} />
                <span>Planned</span>
              </div>
              <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{planned != null ? planned.toLocaleString() : '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>scheduled goods-issues</div>
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', borderLeft: `4px solid ${planVsActualPct && planVsActualPct >= 95 ? 'var(--status-ok)' : 'var(--status-warn)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="trending-up" size={14} />
                <span>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{actual.toLocaleString()}</div>
                {filters.compare === 'prior7d' && <DeltaPill current={actual} prior={priorActual} />}
              </div>
              {planVsActualPct != null && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  <span style={{ color: planVsActualPct >= 95 ? 'var(--status-ok)' : 'var(--status-warn)', fontWeight: 'var(--fw-bold)' }}>{planVsActualPct}%</span> of plan
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <PourTrendChart daily30d={daily30d} hourly24h={hourly24h} defaultRange="30d" onSelectBucket={setSelection} />
            <PourTrendChart daily30d={daily30d} hourly24h={hourly24h} defaultRange="24h" onSelectBucket={setSelection} />
          </div>

          <AnalyticsCorrelationPanel filters={filters} />

          <ContributorsPanel
            title="Pour contributors"
            selection={selection}
            count={selectedEvents.length}
            onClear={() => setSelection(null)}
          >
            {selectedEvents.slice(0, 50).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--line-1)', fontSize: 13 }}>
                <span style={{ fontFamily: 'var(--font-mono)', width: 60 }}>{fmtHour(e.ts_ms)}</span>
                <span style={{ flex: 1 }}>
                  {e.process_order ? (
                    <button 
                      className="btn btn-link" 
                      style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)' }}
                      onClick={() => (window as any).__navigateToOrder?.(e.process_order, { label: e.material_name, _from: 'pours' })}
                    >{e.process_order}</button>
                  ) : '—'} · {e.material_name || 'Material'}
                </span>
                <span style={{ color: 'var(--text-3)', width: 120 }}>{e.source_type || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', width: 80, textAlign: 'right' }}>{e.quantity.toFixed(3)} kg</span>
              </div>
            ))}
            {selectedEvents.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No pour events in this bucket.</div>}
          </ContributorsPanel>

          <PourAnalyticsBreakdown events={events} prior7d={prior7d} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      )}
    </div>
  )
}
