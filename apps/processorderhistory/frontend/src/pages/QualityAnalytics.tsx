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
import { TopBar, Icon, Button, type IconName } from '@connectio/shared-ui'
import { fetchQualityAnalytics, type QualityData, type QualityResultRow, type QualityDaySeries, type QualityHourSeries } from '../api/quality'
import {
  AnalyticsFilterBar,
  AnalyticsCorrelationPanel,
  ContributorsPanel,
  DeltaPill,
  inBucket,
  useAnalyticsFilters,
  type BucketSelection,
} from './analyticsShared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Quality chart with range toggle and hover tooltip.
 * Renders a bar chart (total inspections, coloured by RFT%) for 7 d / 30 d and
 * an area+line chart of RFT% for 24 h (hourly). */
function QualityTrendChart({
  daily30d,
  hourly24h,
  defaultRange = '30d',
  onSelectBucket,
}: {
  daily30d: QualityDaySeries[]
  hourly24h: QualityHourSeries[]
  defaultRange?: '24h' | '7d' | '30d'
  onSelectBucket?: (selection: BucketSelection) => void
}) {
  const [range, setRange] = useState(defaultRange)
  const [tooltip, setTooltip] = useState<{ x: number, y: number, label: string, value: string } | null>(null)

  const W = 560, H = 110, padL = 32, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const bottom = padT + innerH

  const isHourly = range === '24h'
  const barData = range === '7d' ? daily30d.slice(-7) : daily30d

  const maxTotal = barData.length ? Math.max(...barData.map(d => d.accepted + d.rejected), 1) * 1.1 : 1
  const barSlot = innerW / Math.max(barData.length, 1)
  const barW = barSlot - 2

  const lineX = (i: number) => padL + (i / Math.max(hourly24h.length - 1, 1)) * innerW
  const lineY = (v: number) => padT + innerH - (v / 100) * innerH
  const refY = lineY(98)

  // Build contiguous non-null runs for the hourly RFT line
  const runs: any[] = []; let cur: any[] = []
  hourly24h.forEach((d, i) => {
    if (d.rft_pct !== null) { cur.push({ x: lineX(i), y: lineY(d.rft_pct) }) }
    else { if (cur.length > 0) { runs.push(cur); cur = [] } }
  })
  if (cur.length > 0) runs.push(cur)

  const nonNullBar = barData.filter(d => d.rft_pct != null)
  const nonNullLine = hourly24h.filter(d => d.rft_pct != null)
  const metaLabel = isHourly
    ? nonNullLine.length > 0 ? `lowest ${Math.min(...nonNullLine.map(d => d.rft_pct ?? 100)).toFixed(1)}%` : null
    : nonNullBar.length > 0 ? `avg RFT ${(nonNullBar.reduce((a, d) => a + (d.rft_pct ?? 0), 0) / nonNullBar.length).toFixed(1)}%` : null

  const TW = 90, TH = 28
  const ttx = tooltip ? Math.max(padL + TW / 2, Math.min(W - padR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < padT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0

  return (
    <div className="pour-trend-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 16 }}>
      <div className="ptc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
          Quality · {isHourly ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days'}
        </span>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 4, padding: 2 }}>
          {['24h', '7d', '30d'].map(r => (
            <button 
              key={r} 
              className={`btn btn-xs ${range === r ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ height: 20, fontSize: 9, padding: '0 8px' }}
              onClick={() => { setRange(r as any); setTooltip(null) }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg className="pour-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseLeave={() => setTooltip(null)} style={{ overflow: 'visible' }}>

        {isHourly ? (
          <>
            {['0%', '50%', '100%'].map((lbl, i) => {
              const y = padT + innerH - (i * 0.5) * innerH
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line-1)" strokeDasharray="2 3" />
                  <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-3)">{lbl}</text>
                </g>
              )
            })}
            <line x1={padL} y1={refY} x2={W - padR} y2={refY} stroke="var(--status-ok)" strokeDasharray="3 3" strokeWidth="1.5" opacity="0.7" />
            <text x={padL - 4} y={refY + 3} textAnchor="end" fontSize={8} fill="var(--status-ok)">98%</text>
            {runs.map((pts: any[], si: number) => {
              if (pts.length === 0) return null
              const lp = pts.map((p: any, j: number) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
              const ap = lp + ` L${pts[pts.length-1].x.toFixed(1)} ${bottom.toFixed(1)} L${pts[0].x.toFixed(1)} ${bottom.toFixed(1)} Z`
              return <g key={si}><path d={ap} fill="var(--brand)" opacity="0.08" /><path d={lp} fill="none" stroke="var(--brand)" strokeWidth="2" /></g>
            })}
            {hourly24h.map((d, i) => d.rft_pct !== null && (
              <circle key={i} cx={lineX(i)} cy={lineY(d.rft_pct)} r="2.2" fill="var(--brand)" />
            ))}
            {hourly24h.length > 0 && (
              <>
                <text x={padL} y={H} fontSize={9} fill="var(--text-3)">{fmtHour(hourly24h[0].hour)}</text>
                <text x={W - padR} y={H} textAnchor="end" fontSize={9} fill="var(--text-3)">now</text>
              </>
            )}
            {hourly24h.length > 0 && (
              <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" style={{ cursor: 'crosshair' }}
                onMouseMove={e => {
                  const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                  const ctm = svg.getScreenCTM(); if (!ctm) return
                  const { x } = pt.matrixTransform(ctm.inverse())
                  const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - padL) / innerW) * (hourly24h.length - 1))))
                  const d = hourly24h[idx]
                  setTooltip({ x: lineX(idx), y: lineY(d.rft_pct ?? 0), label: fmtHour(d.hour), value: d.rft_pct != null ? d.rft_pct.toFixed(1) + '%' : '—' })
                }}
                onClick={e => {
                  const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                  const ctm = svg.getScreenCTM(); if (!ctm) return
                  const { x } = pt.matrixTransform(ctm.inverse())
                  const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - padL) / innerW) * (hourly24h.length - 1))))
                  const d = hourly24h[idx]
                  onSelectBucket?.({ metric: 'Quality', kind: 'hour', startMs: d.hour, endMs: d.hour + 3_600_000, label: fmtHour(d.hour) })
                }}
              />
            )}
          </>
        ) : (
          <>
            {[0, 0.5, 1].map((p, i) => {
              const y = padT + innerH - p * innerH
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line-1)" strokeDasharray="2 3" />
                  <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-3)">{Math.round(maxTotal * p)}</text>
                </g>
              )
            })}
            {barData.map((d, i) => {
              const total = d.accepted + d.rejected
              if (total === 0 || d.rft_pct == null) return null
              const bx = padL + i * barSlot + 1
              const h = (total / maxTotal) * innerH
              const fill = d.rft_pct >= 98 ? 'var(--status-ok)' : d.rft_pct >= 95 ? 'var(--status-warn)' : 'var(--status-risk)'
              return <rect key={i} x={bx} y={padT + innerH - h} width={barW} height={h} fill={fill} opacity={i === barData.length - 1 ? 1 : 0.6} rx="1" />
            })}
            {barData.length > 0 && (
              <>
                <text x={padL} y={H} fontSize={9} fill="var(--text-3)">{fmtDay(barData[0].date)}</text>
                <text x={W - padR} y={H} textAnchor="end" fontSize={9} fill="var(--text-3)">today</text>
              </>
            )}
            {barData.length > 0 && (
              <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" style={{ cursor: 'crosshair' }}
                onMouseMove={e => {
                  const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                  const ctm = svg.getScreenCTM(); if (!ctm) return
                  const { x } = pt.matrixTransform(ctm.inverse())
                  const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - padL) / barSlot)))
                  const d = barData[idx]
                  const total = d.accepted + d.rejected
                  const h = Math.max((total / maxTotal) * innerH, 0)
                  setTooltip({ x: padL + idx * barSlot + 1 + barW / 2, y: padT + innerH - h, label: fmtDay(d.date), value: d.rft_pct != null ? d.rft_pct.toFixed(1) + '% RFT' : '—' })
                }}
                onClick={e => {
                  const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                  const ctm = svg.getScreenCTM(); if (!ctm) return
                  const { x } = pt.matrixTransform(ctm.inverse())
                  const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - padL) / barSlot)))
                  const d = barData[idx]
                  onSelectBucket?.({ metric: 'Quality', kind: 'day', startMs: d.date, endMs: d.date + 86_400_000, label: fmtDay(d.date) })
                }}
              />
            )}
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
// QualityAnalyticsBreakdown (internal)
// ---------------------------------------------------------------------------

interface BreakdownProps {
  rows: QualityResultRow[]
  prior7d: QualityResultRow[]
  dateFrom: string
  dateTo: string
}

const QUALITY_KEY_FNS: Record<string, (r: QualityResultRow) => string> = {
  characteristic: r => r.characteristic_description ?? r.characteristic_id,
  material:       r => r.material_name ?? r.material_id,
  process_order:  r => r.process_order ?? '—',
  judgement:      r => r.judgement === 'A' ? 'Accepted' : 'Rejected',
}

const QUALITY_DIM_LABEL: Record<string, string> = {
  characteristic: 'Characteristic',
  material:       'Material',
  process_order:  'Process Order',
  judgement:      'Judgement',
}

function QualityAnalyticsBreakdown({ rows, prior7d, dateFrom, dateTo }: BreakdownProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'download'>('analysis')
  const [groupBy, setGroupBy] = useState('characteristic')
  const [sortBy, setSortBy] = useState('rejected')
  const [cardView, setCardView] = useState(false)

  const keyFn = QUALITY_KEY_FNS[groupBy] ?? ((r: QualityResultRow) => r.characteristic_id)
  const isPoOrder = groupBy === 'process_order'

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
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--line-1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Icon name="shield" size={18} />
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Breakdown</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {totalResults.toLocaleString()} results · {periodLabel(dateFrom, dateTo)}
            {activeTab === 'analysis' && ` · grouped by ${QUALITY_DIM_LABEL[groupBy].toLowerCase()}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 6, padding: 4 }}>
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
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>Group by</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['characteristic', 'material', 'process_order', 'judgement'].map(k => (
                <button 
                  key={k} 
                  className={`btn btn-xs ${groupBy === k ? 'btn-secondary' : 'btn-ghost'}`} 
                  onClick={() => setGroupBy(k)}
                >{QUALITY_DIM_LABEL[k]}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>View</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn btn-xs ${!cardView ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setCardView(false)}>Table</button>
              <button className={`btn btn-xs ${cardView ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setCardView(true)}>Cards</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && !cardView && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{QUALITY_DIM_LABEL[groupBy]}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Rejected</th>
                <th style={{ padding: '12px 16px', width: 200 }}></th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Reject %</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>vs avg</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                const vsAvg = avgRejectPct ? ((g.rejectPct - avgRejectPct) / avgRejectPct) * 100 : 0
                return (
                  <tr key={g.key} style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8, fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{g.key}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: g.rejected > 0 ? 'var(--status-risk)' : 'inherit' }}>{g.rejected.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(g.rejected / maxRejected) * 100}%`, background: 'var(--status-risk)' }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.rejectPct.toFixed(1)}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: vsAvg <= 0 ? 'var(--status-ok)' : 'var(--status-risk)' }}>
                      {vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(0)}%
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
              <div key={g.key} style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.key}>{g.key}</div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--status-ok)' }}>{g.accepted.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>accepted · <span style={{ color: g.rejected > 0 ? 'var(--status-risk)' : 'inherit' }}>{g.rejected.toLocaleString()} rejected</span></div>
                {!isPoOrder && dayAvg != null && (
                  <div style={{ fontSize: 11, padding: '4px 8px', background: 'var(--surface-sunken)', borderRadius: 4 }}>
                    <strong>{dayAvg.toFixed(1)}</strong> rejected / day avg · prior 7d
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'download' && (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface-sunken)', borderRadius: 8 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{rows.length.toLocaleString()} rows</div>
            <div style={{ color: 'var(--text-3)' }}>inspection results · {periodLabel(dateFrom, dateTo)}</div>
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
// QualityAnalyticsPage — full page export
// ---------------------------------------------------------------------------

export function QualityAnalyticsPage() {
  const { t } = useT()
  const { filters, setFilters } = useAnalyticsFilters()
  const [pageData, setPageData] = useState<QualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<BucketSelection | null>(null)

  const materialFilter = filters.material
  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo
  const plantId = filters.plantId === 'ALL' ? undefined : filters.plantId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchQualityAnalytics({ plant_id: plantId, date_from: dateFrom, date_to: dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [plantId, dateFrom, dateTo])

  const allRows = pageData?.rows ?? []
  const materials = pageData?.materials ?? []

  const rows = useMemo(
    () => materialFilter === 'ALL' ? allRows : allRows.filter(r => r.material_name === materialFilter || r.material_id === materialFilter),
    [allRows, materialFilter],
  )

  const prior7d = useMemo(() => {
    let list = pageData?.prior7d ?? []
    if (materialFilter !== 'ALL') list = list.filter(r => r.material_name === materialFilter || r.material_id === materialFilter)
    return list
  }, [pageData, materialFilter])

  const daily30d = pageData?.daily30d ?? []
  const hourly24h = pageData?.hourly24h ?? []

  const accepted = rows.filter(r => r.judgement === 'A').length
  const rejected = rows.filter(r => r.judgement === 'R').length
  const total = accepted + rejected
  const rftPct = total > 0 ? (accepted / total) * 100 : null
  const rejectPct = total > 0 ? (rejected / total) * 100 : null
  const qualityTone = rftPct == null ? '' : rftPct >= 98 ? 'good' : rftPct >= 95 ? 'ok' : 'bad'
  const priorAccepted = prior7d.filter(r => r.judgement === 'A').length
  const priorRejected = prior7d.filter(r => r.judgement === 'R').length
  const priorTotal = priorAccepted + priorRejected
  const priorRftPct = filters.compare === 'prior7d' && priorTotal > 0 ? (priorAccepted / priorTotal) * 100 : null
  const selectedRows = selection ? rows.filter(r => inBucket(r.result_date_ms, selection)) : []

  if (error) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Quality analytics' }]} />
        <div style={{ padding: 48, color: 'var(--status-risk)', textAlign: 'center' }}>Failed to load quality analytics: {error}</div>
      </div>
    )
  }

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Quality analytics' }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shield" size={14} />
            <span>Insights</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text-1)' }}>Quality analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Track inspection quality performance across the plant. Monitor accepted vs rejected results,
            right-first-time rate, and the materials or characteristics driving quality losses.
          </p>
        </div>
      </div>

      <AnalyticsFilterBar
        filters={filters}
        onChange={patch => { setFilters(patch); setSelection(null) }}
        materials={materials}
      />

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          Loading quality analytics…
        </div>
      )}

      {!loading && (
        <div style={{ padding: '0 32px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, borderLeft: `4px solid ${qualityTone === 'good' ? 'var(--status-ok)' : qualityTone === 'ok' ? 'var(--status-warn)' : 'var(--status-risk)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="check" size={14} />
                <span>Accepted results</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{accepted.toLocaleString()}</div>
              {rftPct != null && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  <span style={{ color: qualityTone === 'good' ? 'var(--status-ok)' : 'var(--status-warn)', fontWeight: 700 }}>{rftPct.toFixed(1)}% RFT</span>
                </div>
              )}
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="trending-up" size={14} />
                <span>Right first time</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{rftPct != null ? rftPct.toFixed(1) + '%' : '—'}</div>
                {filters.compare === 'prior7d' && <DeltaPill current={rftPct} prior={priorRftPct} />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{total.toLocaleString()} results inspected</div>
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="alert-triangle" size={14} />
                <span>Rejected results</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: rejected > 0 ? 'var(--status-risk)' : 'inherit' }}>{rejected.toLocaleString()}</div>
              {rejectPct != null && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  <span style={{ color: rejectPct > 5 ? 'var(--status-risk)' : 'var(--status-ok)', fontWeight: 700 }}>{rejectPct.toFixed(1)}%</span> reject rate
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <QualityTrendChart daily30d={daily30d} hourly24h={hourly24h} defaultRange="30d" onSelectBucket={setSelection} />
            <QualityTrendChart daily30d={daily30d} hourly24h={hourly24h} defaultRange="24h" onSelectBucket={setSelection} />
          </div>

          <AnalyticsCorrelationPanel filters={filters} />

          <ContributorsPanel
            title="Quality contributors"
            selection={selection}
            count={selectedRows.length}
            onClear={() => setSelection(null)}
          >
            {selectedRows.slice(0, 50).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--line-1)', fontSize: 13 }}>
                <button 
                  className="btn btn-link" 
                  style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)', width: 100, textAlign: 'left' }}
                  onClick={() => (window as any).__navigateToOrder?.(r.process_order, { label: r.material_name, materialId: r.material_id, _from: 'quality' })}
                >{r.process_order}</button>
                <span style={{ flex: 1 }}>{r.characteristic_description || r.characteristic_id}</span>
                <span style={{ color: 'var(--text-3)', width: 150 }}>{r.material_name}</span>
                <span style={{ fontWeight: 600, width: 80, textAlign: 'right', color: r.judgement === 'A' ? 'var(--status-ok)' : 'var(--status-risk)' }}>{r.judgement === 'A' ? 'Accepted' : 'Rejected'}</span>
              </div>
            ))}
            {selectedRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No inspection results in this bucket.</div>}
          </ContributorsPanel>

          <QualityAnalyticsBreakdown rows={rows} prior7d={prior7d} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      )}
    </div>
  )
}
