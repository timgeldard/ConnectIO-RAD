// ---------------------------------------------------------------------------
// Yield analytics types and fetch helper
// ---------------------------------------------------------------------------

import { postJson } from './client'

/** Per-order yield computed from MT-101 (received) and MT-261 (issued) movements. */
export interface YieldOrder {
  process_order_id: string
  material_id: string
  material_name: string
  plant_id: string
  qty_received_kg: number
  qty_issued_kg: number
  yield_pct: number | null
  loss_kg: number | null
  order_date_ms: number
}

/** One entry in the 30-day daily yield series. */
export interface YieldDaySeries {
  date: number             // epoch ms, UTC midnight
  avg_yield_pct: number | null
}

/** One entry in the 24-hour hourly yield series. */
export interface YieldHourSeries {
  hour: number             // epoch ms, UTC hour start
  avg_yield_pct: number | null
}

/** Full yield analytics payload from POST /api/yield/analytics. */
export interface YieldData {
  now_ms: number
  target_yield_pct: number
  materials: string[]
  orders: YieldOrder[]
  prior7d: YieldOrder[]
  daily30d: YieldDaySeries[]
  hourly24h: YieldHourSeries[]
}

/**
 * POST /api/yield/analytics — returns the full yield analytics payload.
 *
 * @param params - Optional filter parameters: plant_id, date_from, date_to.
 * @returns Resolved YieldData payload.
 * @throws Error with status code and body when the request fails.
 */
export async function fetchYieldAnalytics(params?: {
  plant_id?: string
  date_from?: string
  date_to?: string
}): Promise<YieldData> {
  return postJson<YieldData>(
    '/api/yield',
    {
      plant_id: params?.plant_id ?? null,
      date_from: params?.date_from ?? null,
      date_to: params?.date_to ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  )
}
