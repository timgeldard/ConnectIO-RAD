// ---------------------------------------------------------------------------
// Day View types and fetch helper
// ---------------------------------------------------------------------------

import { postJson } from './client'

/** A Gantt block derived from first/last ADP movement on the selected day. */
export interface DayBlock {
  id: string
  poId: string
  lineId: string
  start: number         // epoch ms, clamped to day boundary
  end: number           // epoch ms, clamped to day boundary
  kind: 'running' | 'completed' | 'onhold'
  label: string         // material name
  sublabel: string      // material ID
  confirmedQty: number
  plannedQty: number
  uom: string
}

/** A downtime or issue overlay on the Gantt. */
export interface DayDowntime {
  poId: string
  lineId: string
  start: number
  end: number
  reasonCode: string | null
  issueType: string | null
  issueTitle: string | null
}

/** KPI summary for the selected day. */
export interface DayKpis {
  orderCount: number
  completedCount: number
  confirmedQty: number
  downtimeEvents: number
  downtimeMins: number
}

/** Full Day View payload from POST /api/dayview. */
export interface DayViewData {
  day: string             // ISO date
  day_start_ms: number
  day_end_ms: number
  lines: string[]
  blocks: DayBlock[]
  downtime: DayDowntime[]
  kpis: DayKpis
}

export async function fetchDayView(params?: {
  day?: string
  plantId?: string
}): Promise<DayViewData> {
  return postJson<DayViewData>(
    '/api/dayview',
    {
      day: params?.day ?? null,
      plant_id: params?.plantId ?? null,
    },
  )
}
