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
  material_name: string | null
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

/**
 * Fetch pour analytics (trends and event logs) for a specific plant and date range.
 *
 * @param params Optional filters for plant ID and date range (YYYY-MM-DD).
 * @returns A promise resolving to the PoursData payload.
 * @throws Error if the API request fails.
 */
export async function fetchPoursAnalytics(params?: {
  plantId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<PoursData> {
  const res = await fetch('/api/pours/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plant_id: params?.plantId ?? null,
      date_from: params?.dateFrom ?? null,
      date_to: params?.dateTo ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pours analytics request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<PoursData>
}
