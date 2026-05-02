/**
 * Yield Analytics page — three internal components plus one page export:
 *   - YieldTrendChart      : unified 24h / 7d / 30d toggle with hover tooltip
 *   - YieldBreakdown       : tabbed breakdown table + card view + CSV download
 *   - YieldAnalyticsPage   : full page — KPIs, trend charts, breakdown
 *
 * Mirrors PourAnalytics.tsx patterns exactly, adapted for yield data derived
 * from MT-101 (received) and MT-261 (issued) movements.
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { TopBar, Icon, Button, KPI } from '@connectio/shared-ui'
import { fetchYieldAnalytics, type YieldData, type YieldOrder, type YieldDaySeries, type YieldHourSeries } from '../api/yield'
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

/** Formats an epoch-ms timestamp as a short GB date, e.g. "29 Apr". */
function fmtDay(ms: number) { return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }

/** Formats an epoch-ms timestamp as HH:MM (24-hour, no seconds). */
function fmtHour(ms: number) { return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) }

/**
 * Returns a human-readable period label.
 * When dateFrom equals dateTo, returns just that date; otherwise "a → b".
 */
function periodLabel(a: string, b: string) { return a === b ? a : `${a} → ${b}` }

function getYieldColor(v: number | null, targetYield: number): string {
  if (v == null) return 'inherit'
  if (v >= targetYield) return 'var(--status-ok)'
  if (v >= 85) return 'var(--status-warn)'
  return 'var(--status-risk)'
}

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
  onSelectBucket,
}: {
  daily30d: YieldDaySeries[]
  hourly24h: YieldHourSeries[]
  targetYield: number
  defaultRange?: '24h' | '7d' | '30d'
  onSelectBucket?: (selection: BucketSelection) => void
}) {
  const [range, setRange] = useState(defaultRange)
  const [tooltip, setTooltip] = useState<{ x: number, y: number, label: string, value: string } | null>(null)

  const W = 560, H = 110, padL = 28, padR = 6, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const isHourly = range === '24h'
  const barData = range === '7d' ? daily30d.slice(-7) : daily30d

  // Y-axis: fixed 0–100% range for yield
  const minV = 0, maxV = 100
  const barSlot = innerW / Math.max(barData.length, 1)
  const barW = barSlot - 2

  const lineX = (i: number) => padL + (i / Math.max(hourly24h.length - 1, 1)) * innerW
  const lineY = (v: number) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH
  const barY = (v: number | null) => v == null ? padT + innerH : padT + innerH - ((v - minV) / (maxV - minV)) * innerH
  const barH = (v: number | null) => v == null ? 0 : Math.max(((v - minV) / (maxV - minV)) * innerH, 0)

  // Line chart path (segments break at null values)
  const lineSegments: string[] = []; let seg: string[] = []
  hourly24h.forEach((d, i) => {
    if (d.avg_yield_pct == null) { if (seg.length) { lineSegments.push(seg.join(' ')); seg = [] } }
    else { seg.push(`${seg.length === 0 ? 'M' : 'L'}${lineX(i).toFixed(1)} ${lineY(d.avg_yield_pct).toFixed(1)}`) }
  })
  if (seg.length) lineSegments.push(seg.join(' '))
  const linePath = lineSegments.join(' ')

  // Area fill segments
  const areaSegs: string[] = []; let aStart: { x: string } | null = null; let aPts: string[] = []
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
    areaSegs.push(`M${aPts[0]} ${aPts.slice(1).map(p => `L${p}`).join(' ')} L${lx} ${bot} L${(aStart as any).x} ${bot} Z`)
  }

  const refY = padT + innerH - ((targetYield - minV) / (maxV - minV)) * innerH

  const nonNullBar = barData.filter(d => d.avg_yield_pct != null)
  const nonNullLine = hourly24h.filter(d => d.avg_yield_pct != null)
  const metaLabel = isHourly
    ? nonNullLine.length > 0 ? `peak ${Math.max(...nonNullLine.map(d => d.avg_yield_pct ?? 0)).toFixed(1)}%` : null
    : nonNullBar.length > 0 ? `avg ${(nonNullBar.reduce((a, d) => a + (d.avg_yield_pct ?? 0), 0) / nonNullBar.length).toFixed(1)}% / day` : null

  const TW = 86, TH = 28
  const ttx = tooltip ? Math.max(padL + TW / 2, Math.min(W - padR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < padT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0

  return (
    <div className="pour-trend-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 16 }}>
      <div className="ptc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 13, color: 'var(--text-1)' }}>
          Yield % · {isHourly ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days'}
        </span>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 2 }}>
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

        {[minV, (minV + maxV) / 2, maxV].map((v, i) => {
          const y = padT + innerH - ((v - minV) / (maxV - minV)) * innerH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line-1)" strokeDasharray="2 3" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-3)">{v.toFixed(0)}%</text>
            </g>
          )
        })}
        <line x1={padL} y1={refY} x2={W - padR} y2={refY} stroke="var(--brand)" strokeDasharray="3 3" opacity="0.6" />
        <text x={W - padR - 2} y={refY - 3} textAnchor="end" fontSize={8} fill="var(--brand)">{targetYield}%</text>

        {isHourly && hourly24h.length > 0 && (
          <>
            {areaSegs.map((d, i) => <path key={i} d={d} fill="var(--brand)" opacity="0.08" />)}
            {linePath && <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="2" />}
            {hourly24h.map((d, i) => d.avg_yield_pct != null && (
              <circle key={i} cx={lineX(i)} cy={lineY(d.avg_yield_pct)} r="2.2" fill="var(--brand)" />
            ))}
            <text x={padL} y={H} fontSize={9} fill="var(--text-3)">{fmtHour(hourly24h[0].hour)}</text>
            <text x={W - padR} y={H} textAnchor="end" fontSize={9} fill="var(--text-3)">now</text>
            <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - padL) / innerW) * (hourly24h.length - 1))))
                const d = hourly24h[idx]
                setTooltip({ x: lineX(idx), y: lineY(d.avg_yield_pct ?? 0), label: fmtHour(d.hour), value: d.avg_yield_pct != null ? d.avg_yield_pct.toFixed(1) + '%' : '—' })
              }}
              onClick={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(hourly24h.length - 1, Math.round(((x - padL) / innerW) * (hourly24h.length - 1))))
                const d = hourly24h[idx]
                onSelectBucket?.({ metric: 'Yield', kind: 'hour', startMs: d.hour, endMs: d.hour + 3_600_000, label: fmtHour(d.hour) })
              }}
            />
          </>
        )}

        {!isHourly && barData.length > 0 && (
          <>
            {barData.map((d, i) => {
              if (d.avg_yield_pct == null) return null
              const bx = padL + i * barSlot + 1
              const fill = d.avg_yield_pct >= targetYield ? 'var(--status-ok)' : d.avg_yield_pct >= 85 ? 'var(--status-warn)' : 'var(--status-risk)'
              return (
                <rect key={i} x={bx} y={barY(d.avg_yield_pct)} width={barW} height={barH(d.avg_yield_pct)}
                  fill={fill} opacity={i === barData.length - 1 ? 1 : 0.6} rx="1" />
              )
            })}
            <text x={padL} y={H} fontSize={9} fill="var(--text-3)">{fmtDay(barData[0].date)}</text>
            <text x={W - padR} y={H} textAnchor="end" fontSize={9} fill="var(--text-3)">today</text>
            <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseMove={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - padL) / barSlot)))
                const d = barData[idx]
                setTooltip({ x: padL + idx * barSlot + 1 + barW / 2, y: barY(d.avg_yield_pct), label: fmtDay(d.date), value: d.avg_yield_pct != null ? d.avg_yield_pct.toFixed(1) + '%' : '—' })
              }}
              onClick={e => {
                const svg = e.currentTarget.ownerSVGElement; if (!svg) return
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
                const ctm = svg.getScreenCTM(); if (!ctm) return
                const { x } = pt.matrixTransform(ctm.inverse())
                const idx = Math.max(0, Math.min(barData.length - 1, Math.floor((x - padL) / barSlot)))
                const d = barData[idx]
                onSelectBucket?.({ metric: 'Yield', kind: 'day', startMs: d.date, endMs: d.date + 86_400_000, label: fmtDay(d.date) })
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
// YieldBreakdown — tabbed breakdown table/cards + CSV download
// ---------------------------------------------------------------------------

interface YieldBreakdownProps {
  orders: YieldOrder[]
  prior7d: YieldOrder[]
  dateFrom: string
  dateTo: string
  targetYield: number
}

function YieldBreakdown({ orders, prior7d, dateFrom, dateTo, targetYield }: YieldBreakdownProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'download'>('analysis')
  const [groupBy, setGroupBy] = useState<'material' | 'process_order'>('material')
  const [sortBy, setSortBy] = useState<'yield' | 'name'>('yield')
  const [cardView, setCardView] = useState(false)

  const isPoOrder = groupBy === 'process_order'
  const dimLabel = groupBy === 'material' ? 'Material' : 'Process Order'

  const keyFn = (o: YieldOrder) =>
    groupBy === 'material' ? (o.material_name || o.material_id) : o.process_order_id

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; qtyIssued: number; qtyReceived: number; orderCount: number; materialName: string; materialId: string }>()
    orders.forEach(o => {
      const k = keyFn(o)
      if (!map.has(k)) map.set(k, { key: k, qtyIssued: 0, qtyReceived: 0, orderCount: 0, materialName: o.material_name || o.material_id, materialId: o.material_id })
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
    ? validGroups.reduce((a, g) => a + (g.yieldPct ?? 0), 0) / validGroups.length
    : 0

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

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--line-1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Icon name="trending-up" size={18} />
            <h2 style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', margin: 0 }}>Breakdown</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {groups.length} groups · {periodLabel(dateFrom, dateTo)} · grouped by {dimLabel.toLowerCase()}
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
              <button className={`btn btn-xs ${groupBy === 'material' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setGroupBy('material')}>Material</button>
              <button className={`btn btn-xs ${groupBy === 'process_order' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setGroupBy('process_order')}>Process Order</button>
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>{dimLabel}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Yield %</th>
                <th style={{ padding: '12px 16px', width: 160 }}></th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Issued (kg)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Received (kg)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Loss (kg)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>vs avg</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                const vsAvg = g.yieldPct != null ? g.yieldPct - avgYield : null
                const color = getYieldColor(g.yieldPct, targetYield)
                return (
                  <tr key={g.key} style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8, fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                      {isPoOrder ? (
                        <span>
                          <button
                            className="btn btn-link"
                            style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)' }}
                            onClick={() => (window as any).__navigateToOrder?.(g.key, { label: g.materialName, materialId: g.materialId, _from: 'yield' })}
                          >{g.key}</button>
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)' }}>{g.materialName}</span>
                        </span>
                      ) : (
                        <span style={{ fontWeight: 'var(--fw-semibold)' }}>{g.key}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color }}>
                      {g.yieldPct != null ? g.yieldPct.toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, g.yieldPct ?? 0))}%`, background: color }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.qtyIssued.toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.qtyReceived.toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{g.lossKg != null ? g.lossKg.toFixed(1) : '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: vsAvg != null && vsAvg >= 0 ? 'var(--status-ok)' : 'var(--status-risk)' }}>
                      {vsAvg == null ? '—' : (vsAvg >= 0 ? '+' : '') + vsAvg.toFixed(1) + '%'}
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
            const color = getYieldColor(g.yieldPct, targetYield)
            return (
              <div key={g.key} style={{ padding: 16, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                {isPoOrder ? (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      className="btn btn-link"
                      style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)' }}
                      onClick={() => (window as any).__navigateToOrder?.(g.key, { label: g.materialName, materialId: g.materialId, _from: 'yield' })}
                    >{g.key}</button>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.materialName}>{g.materialName}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.key}>{g.key}</div>
                )}
                <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)', color }}>
                  {g.yieldPct != null ? g.yieldPct.toFixed(1) + '%' : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
                  {g.orderCount} orders · {g.qtyReceived.toFixed(1)} kg rec.
                </div>
                {!isPoOrder && dayAvg != null && (
                  <div style={{ fontSize: 11, padding: '4px 8px', background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)' }}>
                    <strong>{dayAvg.toFixed(1)}%</strong> yield avg · prior 7d
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
            <div style={{ fontSize: 'var(--fs-18)', fontWeight: 'var(--fw-bold)', marginBottom: 4 }}>{orders.length.toLocaleString()} rows</div>
            <div style={{ color: 'var(--text-3)' }}>yield orders · {periodLabel(dateFrom, dateTo)}</div>
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
// YieldAnalyticsPage — full page export
// ---------------------------------------------------------------------------

/**
 * Full-page yield analytics view.
 * Fetches yield data on mount and when date range changes.
 * Displays KPI cards, 30-day and 24-hour trend charts, and a breakdown table.
 */
export function YieldAnalyticsPage() {
  const { t } = useT()
  const { filters, setFilters } = useAnalyticsFilters()
  const [pageData, setPageData] = useState<YieldData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<BucketSelection | null>(null)

  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo
  const materialFilter = filters.material
  const plantId = filters.plantId === 'ALL' ? undefined : filters.plantId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchYieldAnalytics({ plant_id: plantId, date_from: dateFrom, date_to: dateTo })
      .then(d => { if (!cancelled) { setPageData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [plantId, dateFrom, dateTo])

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
    ? validOrders.reduce((a, o) => a + (o.yield_pct ?? 0), 0) / validOrders.length
    : null
  const totalLossKg = filteredOrders.reduce((a, o) => a + (o.loss_kg ?? 0), 0)
  const yieldTone = avgYield == null ? '' : avgYield >= targetYield ? 'good' : avgYield >= 85 ? 'ok' : 'bad'

  const priorValidOrders = filteredPrior7d.filter(o => o.yield_pct != null)
  const priorAvgYield = filters.compare === 'prior7d' && priorValidOrders.length
    ? priorValidOrders.reduce((a, o) => a + (o.yield_pct ?? 0), 0) / priorValidOrders.length
    : null
  const priorLossKg = filters.compare === 'prior7d'
    ? filteredPrior7d.reduce((a, o) => a + (o.loss_kg ?? 0), 0)
    : null
  const selectedOrders = selection ? filteredOrders.filter(o => inBucket(o.order_date_ms, selection)) : []

  if (error) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Yield analytics' }]} />
        <div style={{ padding: 48, color: 'var(--status-risk)', textAlign: 'center' }}>Failed to load yield analytics: {error}</div>
      </div>
    )
  }

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: t.sectionInsights }, { label: 'Yield analytics' }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="trending-up" size={14} />
            <span>Insights</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 'var(--fw-bold)', margin: '8px 0 4px', color: 'var(--text-1)' }}>Yield analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Track process order yield against the quality threshold across the plant.
            Drill in by material or order to identify where losses are occurring.
          </p>
        </div>
      </div>

      <AnalyticsFilterBar
        filters={filters}
        onChange={patch => { setFilters(patch); setSelection(null) }}
        materials={allMaterials}
      />

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          Loading yield analytics…
        </div>
      )}

      {!loading && (
        <div style={{ padding: '0 32px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="alert-triangle" size={14} />
                <span>Target yield</span>
              </div>
              <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{targetYield.toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>yield · quality threshold</div>
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="beaker" size={14} />
                <span>Average yield</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{avgYield != null ? avgYield.toFixed(1) + '%' : '—'}</div>
                {filters.compare === 'prior7d' && <DeltaPill current={avgYield} prior={priorAvgYield} />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{validOrders.length} orders · selected period</div>
            </div>
            <div style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', borderLeft: `4px solid ${yieldTone === 'good' ? 'var(--status-ok)' : yieldTone === 'ok' ? 'var(--status-warn)' : 'var(--status-risk)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
                <Icon name="trending-up" size={14} />
                <span>Total loss</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-32)', fontWeight: 'var(--fw-extrabold)', fontFamily: 'var(--font-mono)' }}>{totalLossKg.toFixed(1)} kg</div>
                {filters.compare === 'prior7d' && <DeltaPill current={totalLossKg} prior={priorLossKg} invert suffix="%" />}
              </div>
              {avgYield != null && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  <span style={{ color: avgYield >= targetYield ? 'var(--status-ok)' : 'var(--status-warn)', fontWeight: 'var(--fw-bold)' }}>{avgYield.toFixed(1)}%</span> avg yield
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <YieldTrendChart daily30d={daily30d} hourly24h={hourly24h} targetYield={targetYield} defaultRange="30d" onSelectBucket={setSelection} />
            <YieldTrendChart daily30d={daily30d} hourly24h={hourly24h} targetYield={targetYield} defaultRange="24h" onSelectBucket={setSelection} />
          </div>

          <AnalyticsCorrelationPanel filters={filters} />

          <ContributorsPanel
            title="Yield contributors"
            selection={selection}
            count={selectedOrders.length}
            onClear={() => setSelection(null)}
          >
            {selectedOrders.slice(0, 50).map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--line-1)', fontSize: 13 }}>
                <button 
                  className="btn btn-link" 
                  style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)', width: 100, textAlign: 'left' }}
                  onClick={() => (window as any).__navigateToOrder?.(o.process_order_id, { label: o.material_name, materialId: o.material_id, _from: 'yield' })}
                >{o.process_order_id}</button>
                <span style={{ flex: 1 }}>{o.material_name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', width: 80, textAlign: 'right', fontWeight: 'var(--fw-semibold)', color: getYieldColor(o.yield_pct, targetYield) }}>{o.yield_pct != null ? o.yield_pct.toFixed(1) + '%' : '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', width: 80, textAlign: 'right', color: 'var(--text-3)' }}>{o.loss_kg != null ? o.loss_kg.toFixed(1) + ' kg' : '—'}</span>
              </div>
            ))}
            {selectedOrders.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No yield orders in this bucket.</div>}
          </ContributorsPanel>

          <YieldBreakdown
            orders={filteredOrders}
            prior7d={filteredPrior7d}
            dateFrom={dateFrom}
            dateTo={dateTo}
            targetYield={targetYield}
          />
        </div>
      )}
    </div>
  )
}
