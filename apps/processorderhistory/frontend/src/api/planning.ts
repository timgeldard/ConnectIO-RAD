// ---------------------------------------------------------------------------
// Planning board types and fetch helper
// ---------------------------------------------------------------------------

/** A single scheduled order block on the Gantt chart. */
export interface PlanningBlock {
  id: string
  poId: string
  lineId: string
  start: number           // epoch ms
  end: number             // epoch ms (start + default 8 h)
  kind: 'running' | 'firm' | 'completed'
  label: string           // material name
  sublabel: string        // material ID
  qty: number
  uom: string
  materialId: string | null
  customer: string | null
  shift: string | null
  operator: string | null
  ratePerH: number | null
  materials: []
  shortageETA: number | null
  shortageItem: string | null
  activeDowntime: null
}

/** An unscheduled / released order in the backlog rail. */
export interface PlanningBacklogItem {
  id: string
  poId: string
  product: string
  materialId: string | null
  category: string | null
  qty: number
  uom: string
  due: number             // epoch ms
  priority: 'urgent' | 'high' | 'normal'
  customer: string
  requiresLine: string
  durationH: number
}

/** KPI values derived from block and backlog data. */
export interface PlanningKpis {
  runningCount: number
  totalLines: number
  todaysQty: number
  todaysCount: number
  utilization: number
  onTimePct: number
  atRiskCount: number
  materialShortCount: number
  wmInTransit: number
  downtimeMinsToday: number
  activeDowntimeCount: number
  backlogCount: number
  backlogUrgent: number
}

/** Full response from POST /api/planning/schedule. */
export interface PlanningScheduleResponse {
  now_ms: number
  today_ms: number
  window_start_ms: number
  window_end_ms: number
  lines: string[]
  blocks: PlanningBlock[]
  backlog: PlanningBacklogItem[]
  kpis: PlanningKpis
}

export async function fetchPlanningSchedule(params?: {
  plantId?: string
}): Promise<PlanningScheduleResponse> {
  const res = await fetch('/api/planning/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_id: params?.plantId ?? null }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Planning schedule request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<PlanningScheduleResponse>
}
