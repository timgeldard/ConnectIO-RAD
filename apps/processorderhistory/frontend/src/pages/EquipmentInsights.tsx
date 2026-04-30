// @ts-nocheck
import { useEffect, useState } from 'react'
import { I, TopBar, fmt } from '../ui'
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

function fmtDay(ms: number) { return fmt.shortDate(ms) }
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
  const metaLabel = isHourly ? `peak ${peakLine} active / hr` : `peak ${peakBar} active / day`

  const TW = 88, TH = 28
  const ttx = tooltip ? Math.max(CL + TW / 2, Math.min(CW - CR - TW / 2, tooltip.x)) : 0
  const tty = tooltip ? (tooltip.y < CT + TH + 8 ? tooltip.y + TH + 10 : tooltip.y - 6) : 0
  const maxV = isHourly ? maxLineV : maxBarV

  return (
    <div className="pour-trend-card">
      <div className="ptc-head">
        <span className="ptc-title">
          {I.cpu} Active instruments · {isHourly ? 'last 24 hours' : 'last 30 days'}
        </span>
        {metaLabel && <span className="ptc-meta mono">{metaLabel}</span>}
        <div className="chart-range-toggle">
          {(['24h', '30d'] as Range[]).map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => { setRange(r); setTooltip(null) }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg className="pour-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none"
        onMouseLeave={() => setTooltip(null)}>

        {[0, 0.5, 1].map((p, gi) => {
          const y = CT + IH - p * IH
          return (
            <g key={gi}>
              <line x1={CL} y1={y} x2={CW - CR} y2={y} stroke="var(--stone-200)" strokeDasharray="2 3" />
              <text x={CL - 4} y={y + 3} textAnchor="end" className="pour-axis-lbl">{Math.round(maxV * p)}</text>
            </g>
          )
        })}

        {isHourly && hourly24h.length > 0 && (
          <>
            <path d={areaPath} fill="var(--valentia-slate)" opacity="0.12" />
            <path d={linePath} fill="none" stroke="var(--valentia-slate)" strokeWidth="2" />
            {hourly24h.map((d, i) => (
              <circle key={i} cx={lineX(i)} cy={lineY(d.active_instruments)} r="2.2" fill="var(--valentia-slate)" />
            ))}
            <text x={CL} y={CH - 4} className="pour-axis-lbl">{fmtHour(hourly24h[0].hour)}</text>
            <text x={CL + IW / 2} y={CH - 4} textAnchor="middle" className="pour-axis-lbl">
              {fmtHour(hourly24h[Math.floor(hourly24h.length / 2)].hour)}
            </text>
            <text x={CW - CR} y={CH - 4} textAnchor="end" className="pour-axis-lbl">now</text>
            <rect x={CL} y={CT} width={IW} height={IH} fill="transparent"
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
                  fill={i === barData.length - 1 ? 'var(--valentia-slate)' : '#1F6E4A'}
                  opacity={i === barData.length - 1 ? 1 : 0.78} rx="1" />
              )
            })}
            <text x={CL} y={CH - 4} className="pour-axis-lbl">{fmtDay(barData[0].date)}</text>
            <text x={CL + IW / 2} y={CH - 4} textAnchor="middle" className="pour-axis-lbl">
              {fmtDay(barData[Math.floor(barData.length / 2)].date)}
            </text>
            <text x={CW - CR} y={CH - 4} textAnchor="end" className="pour-axis-lbl">today</text>
            <rect x={CL} y={CT} width={IW} height={IH} fill="transparent"
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
            <rect x={ttx - TW / 2} y={tty - TH} width={TW} height={TH} rx={3} fill="var(--ink-900)" opacity={0.88} />
            <text x={ttx} y={tty - TH + 10} textAnchor="middle" className="pour-axis-lbl" fill="var(--stone-50)">{tooltip.label}</text>
            <text x={ttx} y={tty - 5} textAnchor="middle" className="pour-axis-lbl" fill="white" fontWeight="600">{tooltip.value}</text>
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
  in_use:    'var(--green-600, #16a34a)',
  dirty:     'var(--amber-600, #d97706)',
  available: 'var(--blue-500, #3b82f6)',
  unknown:   'var(--ink-300, #9ca3af)',
}

/** Instrument readiness distribution bar chart. */
function StateDistribution({ rows }: { rows: InstrumentStateEntry[] }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  const total = rows.reduce((a, r) => a + r.count, 0)
  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.flag}
          <span>Instrument readiness</span>
          <span className="pa-meta">{total.toLocaleString()} instruments with recent history</span>
        </div>
      </div>
      <div className="pa-bars">
        <div className="pa-bars-head">
          <div>State</div>
          <div className="right">Count</div>
          <div></div>
          <div className="right">Share</div>
        </div>
        {rows.filter(r => r.count > 0).map(row => (
          <div key={row.state} className="pa-row">
            <div className="pa-row-name">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[row.state], marginRight: 6, flexShrink: 0 }} />
              <span>{STATE_LABELS[row.state] ?? row.state}</span>
            </div>
            <div className="pa-row-count mono">{row.count.toLocaleString()}</div>
            <div className="pa-row-bar">
              <div className="pa-row-fill" style={{ width: `${(row.count / max) * 100}%`, background: STATE_COLORS[row.state] }} />
            </div>
            <div className="pa-row-vs mono neut">{row.pct}%</div>
          </div>
        ))}
        {rows.every(r => r.count === 0) && (
          <div className="pa-empty">No recent instrument state data available.</div>
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
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.cpu}
          <span>Instrument type distribution</span>
          <span className="pa-meta">{total.toLocaleString()} instruments</span>
        </div>
      </div>
      <div className="pa-bars">
        <div className="pa-bars-head">
          <div>Equipment type</div>
          <div className="right">Count</div>
          <div></div>
          <div className="right">Share</div>
        </div>
        {rows.map((row, i) => (
          <div key={row.equipment_type} className="pa-row">
            <div className="pa-row-name">
              <span className="pa-row-rank mono">#{i + 1}</span>
              <span>{row.equipment_type}</span>
            </div>
            <div className="pa-row-count mono">{row.count.toLocaleString()}</div>
            <div className="pa-row-bar">
              <div className="pa-row-fill" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <div className="pa-row-vs mono neut">{row.pct}%</div>
          </div>
        ))}
        {rows.length === 0 && <div className="pa-empty">No instrument data available.</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scale verification placeholder
// TODO: Replace with real data once a Unity Catalogue consumption view exists
//       for connected_plant_prod.tulip.scale_verification_results.
//       The table cannot be queried directly — UC permissions will crash the app.
//       Steps to enable:
//         1. Create a UC consumption view, e.g.:
//            connected_plant_prod.csm_equipment_history.vw_scale_verification
//         2. Add the view to entities.yaml (change tier from RESTRICTED to APPROVED)
//         3. Add instrument_tbl('vw_scale_verification') query to equipment_insights_dal.py
//         4. Remove this placeholder and render the real data.
// ---------------------------------------------------------------------------

function ScaleVerificationPlaceholder() {
  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.flask}
          <span>Scale verification</span>
          <span className="pa-meta" style={{ color: 'var(--amber, #92400e)', background: 'var(--amber-faint, #fef3c7)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
            Pending data access
          </span>
        </div>
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--ink-400)' }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{I.warning}</span>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 3 }}>Scale calibration data unavailable</div>
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

  const uncategorised = data?.type_distribution.find(r => r.equipment_type === 'Uncategorised')
  const inUse = data?.state_distribution.find(r => r.state === 'in_use')
  const available = data?.state_distribution.find(r => r.state === 'available')

  return (
    <>
      <TopBar trail={['Insights', 'Equipment insights']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.cpu}<span>Insights</span></div>
          <h1 className="page-title">Equipment insights</h1>
          <p className="page-sub">
            Instrument estate, live readiness state, and activity trends.
            Scale verification data is excluded pending Unity Catalogue access.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-500)' }}>
            {I.factory}
            <input
              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--stone-300)', width: 110 }}
              placeholder="All plants"
              value={plantId}
              onChange={e => setPlantId(e.target.value)}
            />
          </label>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Loading equipment data…
        </div>
      )}

      {!loading && error && (
        <div className="page-error">Failed to load equipment insights: {error}</div>
      )}

      {!loading && !error && data && (
        <div className="pa-page-body">
          <div className="pour-grid">
            <div className="pour-kpi tone-actual">
              <div className="pk-l">{I.cpu}<span>Total instruments</span></div>
              <div className="pk-v mono">{data.total_instrument_count.toLocaleString()}</div>
              <div className="pk-sub">in instrument master</div>
            </div>
            <div className="pour-kpi tone-planned">
              <div className="pk-l">{I.layers}<span>Equipment types</span></div>
              <div className="pk-v mono">{data.type_distribution.filter(r => r.equipment_type !== 'Uncategorised').length}</div>
              <div className="pk-sub">distinct categories</div>
            </div>
            {inUse && inUse.count > 0 && (
              <div className="pour-kpi tone-actual">
                <div className="pk-l">{I.flag}<span>In use</span></div>
                <div className="pk-v mono">{inUse.count.toLocaleString()}</div>
                <div className="pk-sub">{inUse.pct}% of instruments with recent history</div>
              </div>
            )}
            {available && available.count > 0 && (
              <div className="pour-kpi tone-target">
                <div className="pk-l">{I.check}<span>Available</span></div>
                <div className="pk-v mono">{available.count.toLocaleString()}</div>
                <div className="pk-sub">{available.pct}% clean / ready</div>
              </div>
            )}
            {uncategorised && (
              <div className="pour-kpi tone-target">
                <div className="pk-l">{I.warning}<span>Uncategorised</span></div>
                <div className="pk-v mono">{uncategorised.count.toLocaleString()}</div>
                <div className="pk-sub">type not yet in gold view</div>
              </div>
            )}
          </div>

          <ActivityTrendChart
            daily30d={data.activity_daily30d}
            hourly24h={data.activity_hourly24h}
          />

          <StateDistribution rows={data.state_distribution} />

          <TypeDistribution rows={data.type_distribution} total={data.total_instrument_count} />

          <ScaleVerificationPlaceholder />
        </div>
      )}
    </>
  )
}
