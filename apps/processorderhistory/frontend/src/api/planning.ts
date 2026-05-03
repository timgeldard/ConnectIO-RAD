// ---------------------------------------------------------------------------
// Planning board types and fetch helper
// ---------------------------------------------------------------------------

import { postJson } from './client'

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

/**
 * Fetch the planning schedule (Gantt blocks, backlog, and KPIs) for a specific plant.
 *
 * @param params Optional filter for plant ID.
 * @returns A promise resolving to the PlanningScheduleResponse payload.
 * @throws Error if the API request fails.
 */
export async function fetchPlanningSchedule(params?: {
  plantId?: string
}): Promise<PlanningScheduleResponse> {
  return postJson<PlanningScheduleResponse>('/api/planning/schedule', { plant_id: params?.plantId ?? null })
}
