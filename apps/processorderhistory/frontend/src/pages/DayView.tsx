// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n/context'
import { TopBar } from '../ui'
import { fetchDayView } from '../api/day_view'
import type { DayViewData, DayBlock, DayDowntime } from '../api/day_view'

const MS_PER_DAY = 86_400_000

// ---- Time helpers ----
function fmtHHMM(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}
function toLocalIso(ms: number): string {
  const d = new Date(ms)
  return d.toISOString().slice(0, 10)
}

// ---- Gantt positioning ----
const toX = (ms: number, dayStart: number) =>
  Math.max(0, Math.min(100, ((ms - dayStart) / MS_PER_DAY) * 100))

// ---- Block colour ----
const KIND_COLOR: Record<string, string> = {
  running: 'var(--valentia-slate)',
  completed: '#1F6E4A',
  onhold: '#B45309',
}

// ---- Tick marks: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 24:00 ----
const TIME_TICKS = [0, 4, 8, 12, 16, 20, 24]

// ---- Swimlane stacking constants ----
const BLOCK_H = 28
const LANE_GAP = 3
const LANE_PAD = 5

/** Greedy interval scheduling: assign each block a lane index so no two
 *  overlapping blocks share a lane.  Blocks sorted by start time. */
function assignLanes(blocks: DayBlock[]): Map<string, number> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start)
  const laneEnds: number[] = []
  const result = new Map<string, number>()
  for (const b of sorted) {
    let lane = laneEnds.findIndex(end => b.start >= end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = b.end
    result.set(b.id, lane)
  }
  return result
}

function laneCount(m: Map<string, number>): number {
  return m.size === 0 ? 1 : Math.max(...m.values()) + 1
}

// ====================================================================
// KPI Strip
// ====================================================================
function KpiStrip({ kpis }: { kpis: DayViewData['kpis'] }) {
  const cards = [
    { label: 'Orders', value: String(kpis.orderCount) },
    { label: 'Completed', value: String(kpis.completedCount) },
    { label: 'Qty confirmed', value: kpis.confirmedQty.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' KG' },
    { label: 'Downtime events', value: String(kpis.downtimeEvents) },
    { label: 'Downtime', value: kpis.downtimeMins > 0 ? kpis.downtimeMins.toFixed(0) + ' min' : '—' },
  ]
  return (
    <div className="dv-kpi-strip">
      {cards.map(c => (
        <div key={c.label} className="dv-kpi-card">
          <div className="dv-kpi-value">{c.value}</div>
          <div className="dv-kpi-label">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ====================================================================
// Block detail drawer (slide-in from the right)
// ====================================================================
function BlockDrawer({ block, onClose }: { block: DayBlock; onClose: () => void }) {
  const kindLabel = block.kind === 'running' ? 'Running' : block.kind === 'completed' ? 'Completed' : 'On hold'
  const rows = [
    ['Process order', block.poId],
    ['Line', block.lineId],
    ['Material', block.label],
    ['Material ID', block.sublabel],
    ['Status', kindLabel],
    ['Start', fmtHHMM(block.start)],
    ['End', fmtHHMM(block.end)],
    ['Duration', ((block.end - block.start) / 3_600_000).toFixed(1) + ' h'],
    ['Planned qty', block.plannedQty.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + block.uom],
    ['Confirmed qty', block.confirmedQty.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + block.uom],
  ]
  return (
    <div className="dv-drawer-backdrop" onClick={onClose}>
      <div className="dv-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-drawer-header">
          <div>
            <div className="dv-drawer-title">{block.label}</div>
            <div className="dv-drawer-sub">{block.poId} · {block.lineId}</div>
          </div>
          <button className="dv-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="dv-drawer-body">
          {rows.map(([k, v]) => (
            <div key={k} className="dv-drawer-row">
              <span className="dv-drawer-key">{k}</span>
              <span className="dv-drawer-val">{v}</span>
            </div>
          ))}
        </div>
        <div className="dv-drawer-footer">
          <button
            className="btn-secondary"
            onClick={() => {
              if ((window as any).__navigateToOrder) {
                (window as any).__navigateToOrder(block.poId, {
                  _from: 'day-view',
                  lineId: block.lineId,
                  label: block.label,
                  materialId: block.sublabel,
                  kind: block.kind,
                  start: block.start,
                  end: block.end,
                  qty: block.plannedQty,
                })
              }
            }}
          >
            Open order detail
          </button>
        </div>
      </div>
    </div>
  )
}

// ====================================================================
// Gantt
// ====================================================================
function DayGantt({
  data,
  onBlockClick,
}: {
  data: DayViewData
  onBlockClick: (b: DayBlock) => void
}) {
  const { day_start_ms: dayStart, day_end_ms: dayEnd, lines, blocks, downtime } = data
  const nowMs = Date.now()
  const isToday = data.day === toLocalIso(nowMs)
  const nowX = isToday ? toX(nowMs, dayStart) : null

  const blocksByLine = useMemo(() => {
    const map: Record<string, DayBlock[]> = {}
    for (const b of blocks) {
      ;(map[b.lineId] ??= []).push(b)
    }
    return map
  }, [blocks])

  const downtimeByLine = useMemo(() => {
    const map: Record<string, DayDowntime[]> = {}
    for (const d of downtime) {
      ;(map[d.lineId] ??= []).push(d)
    }
    return map
  }, [downtime])

  const lanesByLine = useMemo(() => {
    const map: Record<string, Map<string, number>> = {}
    for (const lineId of lines) {
      map[lineId] = assignLanes(blocksByLine[lineId] ?? [])
    }
    return map
  }, [lines, blocksByLine])

  return (
    <div className="dv-gantt">
      {/* Time axis header */}
      <div className="dv-axis-row">
        <div className="dv-axis-label-spacer" />
        <div className="dv-time-axis">
          {TIME_TICKS.map(h => (
            <div key={h} className="dv-tick" style={{ left: `${(h / 24) * 100}%` }}>
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* Lines */}
      {lines.length === 0 ? (
        <div className="dv-empty">No production activity recorded for this day.</div>
      ) : (
        lines.map(lineId => {
          const lineBlocks = blocksByLine[lineId] ?? []
          const lineDowntime = downtimeByLine[lineId] ?? []
          const laneMap = lanesByLine[lineId] ?? new Map<string, number>()
          const numLanes = laneCount(laneMap)
          const timelineH = LANE_PAD * 2 + numLanes * BLOCK_H + Math.max(0, numLanes - 1) * LANE_GAP
          return (
            <div key={lineId} className="dv-line-row">
              <div className="dv-line-label">{lineId}</div>
              <div className="dv-timeline" style={{ height: timelineH + 'px' }}>
                {/* Gridlines at tick positions */}
                {TIME_TICKS.map(h => (
                  <div key={h} className="dv-gridline" style={{ left: `${(h / 24) * 100}%` }} />
                ))}

                {/* Now line (today only) */}
                {nowX !== null && (
                  <div className="dv-now-line" style={{ left: `${nowX}%` }} />
                )}

                {/* Blocks — stacked into lanes to separate concurrent orders */}
                {lineBlocks.map(b => {
                  const left = toX(b.start, dayStart)
                  const width = Math.max(0.3, toX(b.end, dayStart) - left)
                  const lane = laneMap.get(b.id) ?? 0
                  const blockTop = LANE_PAD + lane * (BLOCK_H + LANE_GAP)
                  return (
                    <div
                      key={b.id}
                      className="dv-block"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: blockTop + 'px',
                        background: KIND_COLOR[b.kind] ?? KIND_COLOR.onhold,
                      }}
                      title={`${b.label} · ${fmtHHMM(b.start)}–${fmtHHMM(b.end)}`}
                      onClick={() => onBlockClick(b)}
                    >
                      <span className="dv-block-label">{b.label}</span>
                    </div>
                  )
                })}

                {/* Downtime overlays — span full timeline height */}
                {lineDowntime.map((d, i) => {
                  const left = toX(d.start, dayStart)
                  const width = Math.max(0.2, toX(d.end, dayStart) - left)
                  return (
                    <div
                      key={i}
                      className="dv-downtime"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={d.issueTitle ?? d.issueType ?? 'Downtime'}
                    />
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ====================================================================
// Date navigator
// ====================================================================
function DateNav({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  function shift(delta: number) {
    const d = new Date(day + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    onChange(d.toISOString().slice(0, 10))
  }
  const isToday = day === toLocalIso(Date.now())
  return (
    <div className="dv-date-nav">
      <button className="dv-nav-btn" onClick={() => shift(-1)}>←</button>
      <div className="dv-date-label">
        <span className="dv-date-main">{fmtDate(day)}</span>
        {isToday && <span className="dv-today-badge">Today</span>}
      </div>
      <button className="dv-nav-btn" onClick={() => shift(1)} disabled={isToday}>→</button>
      {!isToday && (
        <button className="dv-nav-today" onClick={() => onChange(toLocalIso(Date.now()))}>
          Today
        </button>
      )}
    </div>
  )
}

// ====================================================================
// Legend
// ====================================================================
function Legend() {
  const items = [
    { color: KIND_COLOR.running, label: 'Running' },
    { color: KIND_COLOR.completed, label: 'Completed' },
    { color: KIND_COLOR.onhold, label: 'On hold' },
    { color: '#DC2626', label: 'Downtime', opacity: 0.35 },
  ]
  return (
    <div className="dv-legend">
      {items.map(({ color, label, opacity }) => (
        <div key={label} className="dv-legend-item">
          <span className="dv-legend-swatch" style={{ background: color, opacity: opacity ?? 1 }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ====================================================================
// Page root
// ====================================================================
export function DayView() {
  const { t } = useT()
  const [day, setDay] = useState(() => toLocalIso(Date.now()))
  const [data, setData] = useState<DayViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<DayBlock | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchDayView({ day })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [day])

  const trail = [t.operations, 'Insights', 'Day view']

  if (loading) {
    return (
      <>
        <TopBar trail={trail} />
        <div className="dv-state-msg">Loading day view…</div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <TopBar trail={trail} />
        <div className="dv-state-msg" style={{ color: 'var(--danger)' }}>
          {error || 'No data available.'}
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar trail={trail} />
      <div className="dv-page">
        <div className="dv-header">
          <div>
            <h1 className="dv-title">Day view</h1>
            <p className="dv-subtitle">Actual production activity by line — ADP movements</p>
          </div>
          <Legend />
        </div>

        <DateNav day={day} onChange={d => { setDay(d); setSelectedBlock(null) }} />

        <KpiStrip kpis={data.kpis} />

        <DayGantt data={data} onBlockClick={setSelectedBlock} />
      </div>

      {selectedBlock && (
        <BlockDrawer block={selectedBlock} onClose={() => setSelectedBlock(null)} />
      )}
    </>
  )
}
