// ---------------------------------------------------------------------------
// Day View types and fetch helper
// ---------------------------------------------------------------------------

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
  const res = await fetch('/api/dayview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      day: params?.day ?? null,
      plant_id: params?.plantId ?? null,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Day View request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<DayViewData>
}
