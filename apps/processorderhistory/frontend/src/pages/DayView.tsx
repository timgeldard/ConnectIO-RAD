import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { TopBar, Icon, Button, KPI } from '@connectio/shared-ui'
import { fetchDayView } from '../api/day_view'
import type { DayViewData, DayBlock, DayDowntime } from '../api/day_view'

const MS_PER_DAY = 86_400_000

// ---- Time helpers ----
function fmtHHMM(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
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
  running: 'var(--brand)',
  completed: 'var(--status-ok)',
  onhold: 'var(--status-warn)',
}

// ---- Tick marks: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 24:00 ----
const TIME_TICKS = [0, 4, 8, 12, 16, 20, 24]

// ---- Swimlane stacking constants ----
const BLOCK_H = 28
const LANE_GAP = 4
const LANE_PAD = 8

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
// Page root
// ====================================================================
export function DayView() {
  const { t } = useT()
  const [day, setDay] = useState(() => toLocalIso(Date.now()))
  const [data, setData] = useState<DayViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<DayBlock | null>(null)
  const [selectedDowntime, setSelectedDowntime] = useState<DayDowntime | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchDayView({ day })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [day])

  if (loading) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Day view' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading day view…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Day view' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)' }}>
          {error || 'No data available.'}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell-full" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Day view' }]} />
      
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column' }}>
        <div className="dv-header" style={{ padding: '24px 32px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 'var(--fw-bold)', margin: '0 0 4px', color: 'var(--text-1)' }}>Day view</h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Actual production activity by line — SAP confirmation records</p>
            </div>
            <Legend />
          </div>

          <DateNav day={day} onChange={d => { setDay(d); setSelectedBlock(null); setSelectedDowntime(null) }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 24 }}>
            <KPI label="Orders" value={data.kpis.orderCount} icon="layers" />
            <KPI label="Completed" value={data.kpis.completedCount} icon="check" tone="ok" />
            <KPI label="Qty confirmed" value={data.kpis.confirmedQty.toLocaleString()} unit="kg" icon="package" />
            <KPI label="Downtime events" value={data.kpis.downtimeEvents} icon="alert-triangle" tone={data.kpis.downtimeEvents > 0 ? 'risk' : 'neutral'} />
            <KPI label="Downtime" value={data.kpis.downtimeMins > 0 ? data.kpis.downtimeMins.toFixed(0) : '0'} unit="min" icon="clock" tone={data.kpis.downtimeMins > 60 ? 'risk' : 'neutral'} />
          </div>
        </div>

        <div style={{ padding: '0 32px 48px' }}>
          <DayGantt
            data={data}
            onBlockClick={b => { setSelectedBlock(b); setSelectedDowntime(null) }}
            onDowntimeClick={d => { setSelectedDowntime(d); setSelectedBlock(null) }}
          />
        </div>
      </div>

      {selectedBlock && (
        <BlockDrawer block={selectedBlock} onClose={() => setSelectedBlock(null)} />
      )}
      {selectedDowntime && (
        <DowntimeDrawer downtime={selectedDowntime} onClose={() => setSelectedDowntime(null)} />
      )}
    </div>
  )
}

// ====================================================================
// Gantt
// ====================================================================
function DayGantt({
  data,
  onBlockClick,
  onDowntimeClick,
}: {
  data: DayViewData
  onBlockClick: (b: DayBlock) => void
  onDowntimeClick: (d: DayDowntime) => void
}) {
  const { day_start_ms: dayStart, lines, blocks, downtime } = data
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
    <div style={{ marginTop: 32, background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
        <div style={{ width: 120, flexShrink: 0, borderRight: '1px solid var(--line-1)', padding: '12px 16px', fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase' }}>Line</div>
        <div style={{ flex: 1, position: 'relative', height: 40 }}>
          {TIME_TICKS.map(h => (
            <div key={h} style={{ position: 'absolute', left: `${(h / 24) * 100}%`, transform: 'translateX(-50%)', top: 12, fontSize: 10, fontWeight: 'var(--fw-semibold)', color: 'var(--text-3)' }}>
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {lines.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No production activity recorded for this day.</div>
      ) : (
        lines.map(lineId => {
          const lineBlocks = blocksByLine[lineId] ?? []
          const lineDowntime = downtimeByLine[lineId] ?? []
          const laneMap = lanesByLine[lineId] ?? new Map<string, number>()
          const numLanes = laneCount(laneMap)
          const timelineH = LANE_PAD * 2 + numLanes * BLOCK_H + Math.max(0, numLanes - 1) * LANE_GAP
          return (
            <div key={lineId} style={{ display: 'flex', borderBottom: '1px solid var(--line-1)' }}>
              <div style={{ width: 120, flexShrink: 0, borderRight: '1px solid var(--line-1)', padding: '16px', display: 'flex', alignItems: 'center', fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font-mono)' }}>{lineId}</div>
              <div style={{ flex: 1, position: 'relative', height: timelineH }}>
                {TIME_TICKS.map(h => (
                  <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`, width: 1, background: 'var(--line-1)', opacity: 0.5 }} />
                ))}

                {nowX !== null && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowX}%`, width: 2, background: 'var(--status-risk)', zIndex: 10 }} />
                )}

                {lineBlocks.map(b => {
                  const left = toX(b.start, dayStart)
                  const width = Math.max(0.3, toX(b.end, dayStart) - left)
                  const lane = laneMap.get(b.id) ?? 0
                  const blockTop = LANE_PAD + lane * (BLOCK_H + LANE_GAP)
                  return (
                    <div
                      key={b.id}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        top: blockTop,
                        height: BLOCK_H,
                        background: KIND_COLOR[b.kind] ?? KIND_COLOR.onhold,
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--fg-on-brand)',
                        fontSize: 11,
                        fontWeight: 'var(--fw-semibold)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        zIndex: 5
                      }}
                      title={`${b.label} · ${fmtHHMM(b.start)}–${fmtHHMM(b.end)}`}
                      onClick={() => onBlockClick(b)}
                    >
                      {width > 2 && b.label}
                    </div>
                  )
                })}

                {lineDowntime.map((d, i) => {
                  const left = toX(d.start, dayStart)
                  const width = Math.max(0.2, toX(d.end, dayStart) - left)
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 0,
                        bottom: 0,
                        background: 'var(--status-risk)',
                        opacity: 0.2,
                        cursor: 'help',
                        zIndex: 2
                      }}
                      title={d.issueTitle ?? d.issueType ?? 'Downtime'}
                      onClick={() => onDowntimeClick(d)}
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
// Components
// ====================================================================

function DateNav({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  function shift(delta: number) {
    const d = new Date(day + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    onChange(d.toISOString().slice(0, 10))
  }
  const isToday = day === toLocalIso(Date.now())
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button variant="secondary" size="sm" onClick={() => shift(-1)} icon={<Icon name="arrow-left" />} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-sunken)', padding: '4px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)' }}>
        <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-16)' }}>{fmtDate(day)}</span>
        {isToday && <span style={{ background: 'var(--status-ok)', color: 'var(--fg-on-brand)', fontSize: 10, fontWeight: 'var(--fw-extrabold)', padding: '2px 8px', borderRadius: 'var(--r-pill)', textTransform: 'uppercase' }}>Today</span>}
      </div>
      <Button variant="secondary" size="sm" onClick={() => shift(1)} disabled={isToday} icon={<Icon name="arrow-right" />} />
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(toLocalIso(Date.now()))}>Go to today</Button>
      )}
    </div>
  )
}

function Legend() {
  const items = [
    { color: KIND_COLOR.running, label: 'Running' },
    { color: KIND_COLOR.completed, label: 'Completed' },
    { color: KIND_COLOR.onhold, label: 'On hold' },
    { color: 'var(--status-risk)', label: 'Downtime', opacity: 0.35 },
  ]
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)' }}>
      {items.map(({ color, label, opacity }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 'var(--r-sm)', background: color, opacity: opacity ?? 1 }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

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
    ['Planned qty', block.plannedQty.toLocaleString() + ' ' + block.uom],
    ['Confirmed qty', block.confirmedQty.toLocaleString() + ' ' + block.uom],
  ]
  return (
    <Drawer title={block.label} sub={block.poId + ' · ' + block.lineId} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-1)', paddingBottom: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-3)' }}>{k}</span>
            <span style={{ fontWeight: 'var(--fw-semibold)' }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 32 }}>
        <Button variant="primary" style={{ width: '100%' }} icon={<Icon name="eye" />}
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
        </Button>
      </div>
    </Drawer>
  )
}

function DowntimeDrawer({ downtime, onClose }: { downtime: DayDowntime; onClose: () => void }) {
  const durationMin = ((downtime.end - downtime.start) / 60_000).toFixed(0)
  const rows = [
    ['Line', downtime.lineId],
    ['Process order', downtime.poId || '—'],
    ['Start', fmtHHMM(downtime.start)],
    ['End', fmtHHMM(downtime.end)],
    ['Duration', durationMin + ' min'],
    ['Issue type', downtime.issueType || '—'],
    ['Issue title', downtime.issueTitle || '—'],
    ['Reason code', downtime.reasonCode || '—'],
  ]
  return (
    <Drawer title={downtime.issueTitle || downtime.issueType || 'Downtime event'} sub={downtime.lineId + ' · ' + fmtHHMM(downtime.start) + '–' + fmtHHMM(downtime.end)} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-1)', paddingBottom: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-3)' }}>{k}</span>
            <span style={{ fontWeight: 'var(--fw-semibold)' }}>{v}</span>
          </div>
        ))}
      </div>
    </Drawer>
  )
}

function Drawer({ title, sub, onClose, children }: { title: string, sub: string, onClose: () => void, children: any }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 360, background: 'var(--surface-0)', boxShadow: 'var(--shadow-md)', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{sub}</div>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
