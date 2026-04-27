// @ts-nocheck
/**
 * Pour Performance — three exports:
 *   - PourKpiCards     : 3 KPI tiles (Target/Planned/Actual) — used on Order List
 *   - PourLineFilter   : a compact <select> chip — placed in page-head-actions
 *   - PourAnalyticsPage: full insights page — trend charts + analytics breakdown
 *
 * The line filter is OWNED BY THE PARENT (OrderList holds the state and passes
 * value+onChange in). On the Insights page, the page itself owns it.
 *
 * Pours = goods issues. One pour = one decant (tank/IBC/tote → process).
 */
import { useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { I, TopBar } from '../ui'
import { buildPoursData } from '../data/mock'

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

let _data: any = null
function getData(): any {
  if (!_data) _data = buildPoursData()
  return _data
}

function useFilteredPours(lineFilter: string) {
  const data = useMemo(() => getData(), [])
  return useMemo(() => {
    const filteredPours = lineFilter === 'ALL'
      ? data.pours
      : data.pours.filter((p: any) => p.lineId === lineFilter)
    const filteredLast24 = lineFilter === 'ALL'
      ? data.last24
      : data.last24.filter((p: any) => p.lineId === lineFilter)
    const target = lineFilter === 'ALL'
      ? data.kpis.targetPer24h
      : (data.lines.find((x: any) => x.id === lineFilter)?.target ?? 0)
    const actual = filteredLast24.length
    const planned = Math.round(actual / 0.86)
    const completionPct = target ? Math.round((actual / target) * 100) : 0
    const planVsActualPct = planned ? Math.round((actual / planned) * 100) : 0

    let daily30d
    if (lineFilter === 'ALL') daily30d = data.daily30d
    else {
      const dayBuckets = data.daily30d.map((d: any) => ({ ...d, actual: 0 }))
      filteredPours.forEach((p: any) => {
        for (let i = 0; i < dayBuckets.length; i++) {
          const ds = dayBuckets[i].date
          const de = i + 1 < dayBuckets.length ? dayBuckets[i + 1].date : data.NOW + DAY
          if (p.ts >= ds && p.ts < de) { dayBuckets[i].actual++; break }
        }
      })
      daily30d = dayBuckets.map((d: any) => ({ ...d, target }))
    }

    let hourly24h
    if (lineFilter === 'ALL') hourly24h = data.hourly24h
    else {
      const hourBuckets = data.hourly24h.map((h: any) => ({ ...h, actual: 0, target: Math.round(target / 24) }))
      filteredLast24.forEach((p: any) => {
        for (let i = 0; i < hourBuckets.length; i++) {
          const hs = hourBuckets[i].hour
          const he = i + 1 < hourBuckets.length ? hourBuckets[i + 1].hour : data.NOW
          if (p.ts >= hs && p.ts < he) { hourBuckets[i].actual++; break }
        }
      })
      hourly24h = hourBuckets
    }

    return { data, filteredPours, filteredLast24, target, actual, planned, completionPct, planVsActualPct, daily30d, hourly24h }
  }, [data, lineFilter])
}

function fmtDay(ms: number) { return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }
function fmtHour(ms: number) { return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) }

function TrendChart30d({ data }: { data: any[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxV = Math.max(...data.map(d => Math.max(d.actual, d.target))) * 1.1
  const barW = innerW / data.length - 2
  const targetY = padT + innerH - (data[0].target / maxV) * innerH
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
        const meets = d.actual >= d.target * 0.95
        return (
          <rect key={i} x={x} y={y} width={barW} height={h}
            fill={isToday ? 'var(--valentia-slate)' : (meets ? '#1F6E4A' : '#C04A1F')}
            opacity={isToday ? 1 : 0.78} rx="1" />
        )
      })}
      <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke="var(--sunset)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={W - padR} y={targetY - 3} textAnchor="end" className="pour-axis-lbl" fill="var(--sunset)">target {data[0].target}</text>
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtDay(data[0].date)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtDay(data[Math.floor(data.length / 2)].date)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">today</text>
    </svg>
  )
}

function TrendChart24h({ data }: { data: any[] }) {
  if (!data?.length) return null
  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxV = Math.max(...data.map(d => Math.max(d.actual, d.target))) * 1.15
  const xFor = (i: number) => padL + (i / (data.length - 1)) * innerW
  const yFor = (v: number) => padT + innerH - (v / maxV) * innerH
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(d.actual).toFixed(1)}`).join(' ')
  const area = path + ` L${xFor(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L${xFor(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
  const targetY = yFor(data[0].target)
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
      <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke="var(--sunset)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={W - padR} y={targetY - 3} textAnchor="end" className="pour-axis-lbl" fill="var(--sunset)">target {data[0].target}/h</text>
      <text x={padL} y={H - 4} className="pour-axis-lbl">{fmtHour(data[0].hour)}</text>
      <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" className="pour-axis-lbl">{fmtHour(data[Math.floor(data.length / 2)].hour)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" className="pour-axis-lbl">now</text>
    </svg>
  )
}

interface PourLineFilterProps {
  value: string
  onChange: (next: string) => void
}

export function PourLineFilter({ value, onChange }: PourLineFilterProps) {
  const data = useMemo(() => getData(), [])
  return (
    <div className="pss-filter">
      <label className="pss-flbl">{I.factory}<span>Line</span></label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="ALL">All lines · {data.lines.length}</option>
        {data.lines.map((l: any) => (
          <option key={l.id} value={l.id}>{l.id} · {l.name}</option>
        ))}
      </select>
    </div>
  )
}

interface PourKpiCardsProps {
  lineFilter: string
}

export function PourKpiCards({ lineFilter }: PourKpiCardsProps) {
  const f = useFilteredPours(lineFilter)
  const { target, actual, planned, completionPct, planVsActualPct, data } = f

  return (
    <div className="pour-kpi-strip">
      <div className="pour-kpi-strip-head">
        <span className="pss-eyebrow">{I.package}<span>Pour performance · last 24h</span></span>
        <span className="pss-meta mono">
          {data.NOW ? new Date(data.NOW).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
          {lineFilter !== 'ALL' && <span className="pss-line-pill">· {lineFilter}</span>}
        </span>
        <div style={{ flex: 1 }} />
        <a className="pss-link" onClick={() => (window as any).__navigateToPourAnalytics && (window as any).__navigateToPourAnalytics()}>
          View pour analytics {I.arrowR}
        </a>
      </div>
      <div className="pour-grid">
        <div className="pour-kpi tone-target">
          <div className="pk-l">{I.alert}<span>Target / 24h</span></div>
          <div className="pk-v mono">{target.toLocaleString()}</div>
          <div className="pk-sub">pours · capacity ceiling</div>
        </div>
        <div className="pour-kpi tone-planned">
          <div className="pk-l">{I.calendar}<span>Planned / 24h</span></div>
          <div className="pk-v mono">{planned.toLocaleString()}</div>
          <div className="pk-sub">scheduled goods-issues</div>
          <div className="pk-bar">
            <div className="pk-fill plan" style={{ width: `${Math.min(100, (planned / Math.max(target, 1)) * 100)}%` }} />
          </div>
          <div className="pk-bar-l">
            <span className="mono">{Math.round((planned / Math.max(target, 1)) * 100)}%</span>
            <span>of target</span>
          </div>
        </div>
        <div className={`pour-kpi tone-actual ${completionPct >= 95 ? 'good' : completionPct >= 80 ? 'ok' : 'bad'}`}>
          <div className="pk-l">{I.trending}<span>Actual / 24h</span></div>
          <div className="pk-v mono">{actual.toLocaleString()}</div>
          <div className="pk-sub">
            <span className={`pk-delta ${planVsActualPct >= 95 ? 'pos' : planVsActualPct >= 85 ? 'neut' : 'neg'}`}>
              {planVsActualPct}% of plan
            </span>
            <span> · </span>
            <span className={`pk-delta ${completionPct >= 95 ? 'pos' : completionPct >= 80 ? 'neut' : 'neg'}`}>
              {completionPct}% of target
            </span>
          </div>
          <div className="pk-bar">
            <div className="pk-fill act" style={{ width: `${Math.min(100, (actual / Math.max(target, 1)) * 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PourAnalytics({ pours }: { pours: any[] }) {
  const [groupBy, setGroupBy] = useState('operator')
  const [sortBy, setSortBy] = useState('count')

  const groups = useMemo(() => {
    const keyFn: Record<string, (p: any) => string> = {
      operator: p => p.operator,
      shift: p => `Shift ${p.shift}`,
      line: p => p.lineId,
      source: p => p.sourceArea,
    }
    const map = new Map<string, { key: string; count: number; kg: number }>()
    pours.forEach(p => {
      const k = keyFn[groupBy](p)
      if (!map.has(k)) map.set(k, { key: k, count: 0, kg: 0 })
      const e = map.get(k)!
      e.count++
      e.kg += p.qty
    })
    let arr = Array.from(map.values())
    if (sortBy === 'count') arr.sort((a, b) => b.count - a.count)
    else arr.sort((a, b) => a.key.localeCompare(b.key))
    return arr
  }, [pours, groupBy, sortBy])

  const total = groups.reduce((a, g) => a + g.count, 0)
  const max = Math.max(1, ...groups.map(g => g.count))
  const avg = groups.length ? total / groups.length : 0

  const dimLabel: Record<string, string> = { operator: 'Operator', shift: 'Shift', line: 'Line', source: 'Source area' }

  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.trending}
          <span>Breakdown</span>
          <span className="pa-meta">{total.toLocaleString()} pours · last 24h · grouped by {dimLabel[groupBy].toLowerCase()}</span>
        </div>
        <div className="pa-controls">
          <div className="pa-seg">
            <span className="pa-seg-l">Group by</span>
            {[
              { k: 'operator', label: 'Operator' },
              { k: 'shift', label: 'Shift' },
              { k: 'line', label: 'Line' },
              { k: 'source', label: 'Source area' },
            ].map(o => (
              <button key={o.k} className={groupBy === o.k ? 'active' : ''} onClick={() => setGroupBy(o.k)}>{o.label}</button>
            ))}
          </div>
          <div className="pa-seg">
            <span className="pa-seg-l">Sort</span>
            <button className={sortBy === 'count' ? 'active' : ''} onClick={() => setSortBy('count')}>Count</button>
            <button className={sortBy === 'name' ? 'active' : ''} onClick={() => setSortBy('name')}>Name</button>
          </div>
        </div>
      </div>

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
    </div>
  )
}

export function PourAnalyticsPage() {
  const { t } = useT()
  const [lineFilter, setLineFilter] = useState('ALL')
  const f = useFilteredPours(lineFilter)
  const { target, actual, planned, completionPct, planVsActualPct, daily30d, hourly24h, filteredLast24 } = f

  return (
    <>
      <TopBar trail={[t.operations || 'Operations', t.sectionInsights || 'Insights', 'Pour analytics']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.trending}<span>Insights</span></div>
          <h1 className="page-title">Pour analytics</h1>
          <p className="page-sub">
            Track goods-issue pours against target and plan across all lines. Drill in by operator, shift,
            line, or source area to see who's pouring what — and where bottlenecks form.
          </p>
        </div>
        <div className="page-head-actions">
          <PourLineFilter value={lineFilter} onChange={setLineFilter} />
          <button className="btn secondary">{I.printer}<span>Export</span></button>
        </div>
      </div>

      <div className="pa-page-body">
        <div className="pour-grid pour-grid-page">
          <div className="pour-kpi tone-target">
            <div className="pk-l">{I.alert}<span>Target / 24h</span></div>
            <div className="pk-v mono">{target.toLocaleString()}</div>
            <div className="pk-sub">pours · capacity ceiling</div>
          </div>
          <div className="pour-kpi tone-planned">
            <div className="pk-l">{I.calendar}<span>Planned / 24h</span></div>
            <div className="pk-v mono">{planned.toLocaleString()}</div>
            <div className="pk-sub">scheduled goods-issues</div>
            <div className="pk-bar">
              <div className="pk-fill plan" style={{ width: `${Math.min(100, (planned / Math.max(target, 1)) * 100)}%` }} />
            </div>
            <div className="pk-bar-l">
              <span className="mono">{Math.round((planned / Math.max(target, 1)) * 100)}%</span>
              <span>of target</span>
            </div>
          </div>
          <div className={`pour-kpi tone-actual ${completionPct >= 95 ? 'good' : completionPct >= 80 ? 'ok' : 'bad'}`}>
            <div className="pk-l">{I.trending}<span>Actual / 24h</span></div>
            <div className="pk-v mono">{actual.toLocaleString()}</div>
            <div className="pk-sub">
              <span className={`pk-delta ${planVsActualPct >= 95 ? 'pos' : planVsActualPct >= 85 ? 'neut' : 'neg'}`}>{planVsActualPct}% of plan</span>
              <span> · </span>
              <span className={`pk-delta ${completionPct >= 95 ? 'pos' : completionPct >= 80 ? 'neut' : 'neg'}`}>{completionPct}% of target</span>
            </div>
            <div className="pk-bar">
              <div className="pk-fill act" style={{ width: `${Math.min(100, (actual / Math.max(target, 1)) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="pour-trends">
          <div className="pour-trend-card">
            <div className="ptc-head">
              <span className="ptc-title">Pours per day · last 30 days</span>
              <span className="ptc-meta mono">avg {Math.round(daily30d.reduce((a: number, d: any) => a + d.actual, 0) / daily30d.length)} / day</span>
            </div>
            <TrendChart30d data={daily30d} />
          </div>
          <div className="pour-trend-card">
            <div className="ptc-head">
              <span className="ptc-title">Pours per hour · last 24 hours</span>
              <span className="ptc-meta mono">peak {Math.max(...hourly24h.map((h: any) => h.actual))} / hr</span>
            </div>
            <TrendChart24h data={hourly24h} />
          </div>
        </div>

        <PourAnalytics pours={filteredLast24} />
      </div>
    </>
  )
}
