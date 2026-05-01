import { useEffect, useState } from 'react'
import { TopBar, Icon, KPI, Button } from '@connectio/shared-ui'
import { useT } from '../i18n/context'
import {
  fetchEquipmentInsights,
  type EquipmentInsightsData,
  type EquipmentTypeEntry,
  type InstrumentStateEntry,
  type ActivityDaySeries,
  type ActivityHourSeries,
} from '../api/equipment_insights'

// ---------------------------------------------------------------------------
// Chart constants — shared with PourTrendChart geometry
// ---------------------------------------------------------------------------

const CW = 560, CH = 110, CL = 28, CR = 6, CT = 6, CB = 16
const IW = CW - CL - CR, IH = CH - CT - CB

type Range = '24h' | '30d'
interface TooltipData { x: number; y: number; label: string; value: string }

function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtHour(ms: number) {
  const d = new Date(ms)
  return d.getHours().toString().padStart(2, '0') + ':00'
}

// ---------------------------------------------------------------------------
// Activity trend chart — active instruments per hour / per day
// ---------------------------------------------------------------------------

/** Active-instrument trend chart with 24h / 30d range toggle and hover tooltip. */
function ActivityTrendChart({
  daily30d,
  hourly24h,
}: {
  daily30d: ActivityDaySeries[]
  hourly24h: ActivityHourSeries[]
}) {
  const [range, setRange] = useState<Range>('30d')
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const isHourly = range === '24h'

  const barData = daily30d
  const maxBarV = barData.length ? Math.max(...barData.map(d => d.active_instruments), 1) * 1.1 : 1
  const barSlot = IW / Math.max(barData.length, 1)
  const barW = barSlot - 2

  const maxLineV = hourly24h.length ? Math.max(...hourly24h.map(d => d.active_instruments), 1) * 1.15 : 1
  const lineX = (i: number) => CL + (i / Math.max(hourly24h.length - 1, 1)) * IW
  const lineY = (v: number) => CT + IH - (v / maxLineV) * IH

  const linePath = hourly24h.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${lineX(i).toFixed(1)} ${lineY(d.active_instruments).toFixed(1)}`
  ).join(' ')
  const areaPath = hourly24h.length > 1
    ? `${linePath} L${lineX(hourly24h.length - 1).toFixed(1)} ${(CT + IH).toFixed(1)} L${lineX(0).toFixed(1)} ${(CT + IH).toFixed(1)} Z`
    : ''

  const peakBar = barData.length ? Math.max(...barData.map(d => d.active_instruments)) : 0
  const peakLine = hourly24h.length ? Math.max(...hourly24h.map(d => d.active_instruments)) : 0
  const metaLabel = isHourly ? `peak ${peakLine} active / hr` : peakBar > 0 ? `peak ${peakBar} active / day` : null

  const TW = 88, TH = 28
  const ttx = tooltip ? Math.max(CL + TW / 2, Math.min(CW - CR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < CT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0
  const maxV = isHourly ? maxLineV : maxBarV

  return (
    <div className="pour-trend-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 16 }}>
      <div className="ptc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="cpu" size={14} /> Active instruments · {isHourly ? 'last 24 hours' : 'last 30 days'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {metaLabel && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{metaLabel}</span>}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 4, padding: 2 }}>
            {(['24h', '30d'] as Range[]).map(r => (
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
              <circle key={i} cx={lineX(i)} cy={lineY(d.active_instruments)} r="2.2" fill="var(--brand)" />
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
                setTooltip({ x: lineX(idx), y: lineY(d.active_instruments), label: fmtHour(d.hour), value: d.active_instruments.toLocaleString() })
              }}
            />
          </>
        )}

        {!isHourly && barData.length > 0 && (
          <>
            {barData.map((d, i) => {
              const bx = CL + i * barSlot + 1
              const h = Math.max((d.active_instruments / maxBarV) * IH, 0)
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
                const bh = Math.max((d.active_instruments / maxBarV) * IH, 0)
                setTooltip({ x: CL + idx * barSlot + 1 + barW / 2, y: CT + IH - bh, label: fmtDay(d.date), value: d.active_instruments.toLocaleString() })
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
// State distribution — IN USE / DIRTY / AVAILABLE / Unknown
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<string, string> = {
  in_use:    'In use',
  dirty:     'Dirty / needs clean',
  available: 'Available / clean',
  unknown:   'Unknown',
}

const STATE_COLORS: Record<string, string> = {
  in_use:    'var(--status-ok)',
  dirty:     'var(--status-warn)',
  available: 'var(--brand)',
  unknown:   'var(--line-1)',
}

/** Instrument readiness distribution bar chart. */
function StateDistribution({ rows }: { rows: InstrumentStateEntry[] }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  const total = rows.reduce((a, r) => a + r.count, 0)
  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Icon name="flag" size={18} />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Instrument readiness</h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{total.toLocaleString()} instruments with recent history</span>
      </div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>State</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Count</th>
              <th style={{ padding: '12px 16px', width: 240 }}></th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => r.count > 0).map(row => (
              <tr key={row.state} style={{ borderBottom: '1px solid var(--line-1)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[row.state] || 'var(--line-1)' }} />
                    <span style={{ fontWeight: 600 }}>{STATE_LABELS[row.state] ?? row.state}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.count.toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.count / max) * 100}%`, background: STATE_COLORS[row.state] || 'var(--line-1)' }} />
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.every(r => r.count === 0) && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No recent instrument state data available.</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type distribution breakdown
// ---------------------------------------------------------------------------

/** Instrument count breakdown by derived EQUIPMENT_TYPE. */
function TypeDistribution({ rows, total }: { rows: EquipmentTypeEntry[]; total: number }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Icon name="cpu" size={18} />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Instrument type distribution</h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{total.toLocaleString()} instruments</span>
      </div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Equipment type</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Count</th>
              <th style={{ padding: '12px 16px', width: 240 }}></th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.equipment_type} style={{ borderBottom: '1px solid var(--line-1)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                    <span style={{ fontWeight: 600 }}>{row.equipment_type}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.count.toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.count / max) * 100}%`, background: 'var(--brand)' }} />
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No instrument data available.</div>}
      </div>
    </div>
  )
}

function ScaleVerificationPlaceholder() {
  return (
    <div style={{ marginTop: 48, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="beaker" size={18} />
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Scale verification</h2>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'var(--status-warn-surface)', color: 'var(--status-warn)', textTransform: 'uppercase' }}>Pending data access</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', color: 'var(--text-3)' }}>
        <Icon name="alert-triangle" size={18} style={{ color: 'var(--status-warn)' }} />
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Scale calibration data unavailable</div>
          Scale verification results from Tulip require a Unity Catalogue consumption view
          before they can be queried. Once created, this card will show pass/fail status
          and verification history per scale.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

/** Equipment Insights page — instrument estate, readiness, and activity. */
export function EquipmentInsightsPage() {
  const { t } = useT()
  const [plantId, setPlantId] = useState('')
  const [data, setData] = useState<EquipmentInsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEquipmentInsights({ plantId: plantId.trim() || undefined })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [plantId])

  const inUse = data?.state_distribution.find(r => r.state === 'in_use')
  const available = data?.state_distribution.find(r => r.state === 'available')

  if (loading) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading equipment data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)' }}>{error || 'No data available.'}</div>
      </div>
    )
  }

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights' }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="cpu" size={14} />
              <span>Insights</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-1)' }}>Equipment insights</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Instrument estate, live readiness state, and activity trends.
              Scale verification data is excluded pending Unity Catalogue access.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-sunken)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line-1)' }}>
            <Icon name="factory" size={14} style={{ color: 'var(--text-3)' }} />
            <input
              style={{ fontSize: 13, border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--text-1)', width: 100 }}
              placeholder="All plants"
              value={plantId}
              onChange={e => setPlantId(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 32 }}>
          <KPI label="Total instruments" value={data.total_instrument_count.toLocaleString()} icon="cpu" />
          <KPI label="Equipment types" value={data.type_distribution.filter(r => r.equipment_type !== 'Uncategorised').length} icon="layers" />
          <KPI 
            label="In use" 
            value={inUse?.count || 0} 
            unit={`${inUse?.pct || 0}%`} 
            icon="flag" 
            tone={inUse?.count ? 'ok' : 'neutral'} 
          />
          <KPI 
            label="Available" 
            value={available?.count || 0} 
            unit={`${available?.pct || 0}%`} 
            icon="check" 
            tone="ok" 
          />
          <KPI 
            label="Uncategorised" 
            value={data.type_distribution.find(r => r.equipment_type === 'Uncategorised')?.count || 0} 
            icon="alert-triangle" 
            tone="neutral" 
          />
        </div>
      </div>

      <div style={{ padding: '32px 32px 48px' }}>
        <ActivityTrendChart
          daily30d={data.activity_daily30d}
          hourly24h={data.activity_hourly24h}
        />

        <StateDistribution rows={data.state_distribution} />

        <TypeDistribution rows={data.type_distribution} total={data.total_instrument_count} />

        <ScaleVerificationPlaceholder />
      </div>
    </div>
  )
}
