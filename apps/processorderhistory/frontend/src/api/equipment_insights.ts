// ---------------------------------------------------------------------------
// Equipment insights types and fetch helper
// ---------------------------------------------------------------------------

/** One row in the equipment type distribution. */
export interface EquipmentTypeEntry {
  equipment_type: string
  count: number
  pct: number
}

/**
 * One row in the instrument state distribution.
 * State is classified from the latest STATUS_TO keyword in vw_gold_equipment_history.
 */
export interface InstrumentStateEntry {
  state: 'in_use' | 'dirty' | 'available' | 'unknown'
  count: number
  pct: number
}

/** One entry in the 30-day daily activity series. */
export interface ActivityDaySeries {
  date: number              // epoch ms, local midnight
  active_instruments: number
}

/** One entry in the 24-hour hourly activity series. */
export interface ActivityHourSeries {
  hour: number              // epoch ms, local hour start
  active_instruments: number
}

/** Full equipment insights payload from POST /api/equipment-insights/summary. */
export interface EquipmentInsightsData {
  total_instrument_count: number
  type_distribution: EquipmentTypeEntry[]
  state_distribution: InstrumentStateEntry[]
  activity_daily30d: ActivityDaySeries[]
  activity_hourly24h: ActivityHourSeries[]
}

/**
 * Fetch equipment master distribution, live state, and activity trends.
 *
 * POSTs to `/api/equipment-insights/summary` with an optional plant filter.
 * The response includes instrument counts by type, state distribution from the
 * latest STATUS_TO per instrument, and 30-day / 24-hour activity trend series.
 *
 * @param params Optional plant filter and timezone override.
 * @returns A promise resolving to the EquipmentInsightsData payload.
 * @throws Error if the API request fails.
 */
export async function fetchEquipmentInsights(params?: {
  plantId?: string
  timezone?: string
}): Promise<EquipmentInsightsData> {
  const res = await fetch('/api/equipment-insights/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plant_id: params?.plantId ?? null,
      timezone: params?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Equipment insights request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<EquipmentInsightsData>
}
