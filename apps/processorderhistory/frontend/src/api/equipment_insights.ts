// ---------------------------------------------------------------------------
// Equipment insights types and fetch helper
// ---------------------------------------------------------------------------

/** One row in the equipment type distribution. */
export interface EquipmentTypeEntry {
  equipment_type: string
  count: number
  pct: number
}

/** Full equipment insights payload from POST /api/equipment-insights/summary. */
export interface EquipmentInsightsData {
  total_instrument_count: number
  type_distribution: EquipmentTypeEntry[]
}

/**
 * Fetch equipment master distribution (instrument counts by type).
 *
 * @param params Optional plant filter.
 * @returns A promise resolving to the EquipmentInsightsData payload.
 * @throws Error if the API request fails.
 */
export async function fetchEquipmentInsights(params?: {
  plantId?: string
}): Promise<EquipmentInsightsData> {
  const res = await fetch('/api/equipment-insights/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ plant_id: params?.plantId ?? null }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Equipment insights request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<EquipmentInsightsData>
}
