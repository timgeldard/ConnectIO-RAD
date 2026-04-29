// ---------------------------------------------------------------------------
// Pour analytics types and fetch helper
// ---------------------------------------------------------------------------

/** A single pour event (movement type-261) for the requested date range. */
export interface PourEvent {
  ts_ms: number
  line_id: string
  operator: string | null
  source_area: string | null
  source_type: string | null
  process_order: string | null
  quantity: number
  uom: string | null
  shift: string | null
}

/** One entry in the 30-day daily trend series. */
export interface DaySeries {
  date: number       // epoch ms, UTC midnight
  actual: number
  target: number | null
  planned: number | null
}

/** One entry in the 24-hour hourly trend series. */
export interface HourSeries {
  hour: number       // epoch ms, UTC hour start
  actual: number
  target: number | null
}

/** Full pour analytics payload from POST /api/pours/analytics. */
export interface PoursData {
  now_ms: number
  planned_24h: number | null
  lines: string[]
  events: PourEvent[]
  prior7d: PourEvent[]
  daily30d: Record<string, DaySeries[]>
  hourly24h: Record<string, HourSeries[]>
}

export async function fetchPoursAnalytics(params?: {
  plantId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<PoursData> {
  const res = await fetch('/api/pours/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plant_id: params?.plantId ?? null,
      date_from: params?.dateFrom ?? null,
      date_to: params?.dateTo ?? null,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pours analytics request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<PoursData>
}
