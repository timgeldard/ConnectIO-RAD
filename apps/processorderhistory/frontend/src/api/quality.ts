// ---------------------------------------------------------------------------
// Quality analytics types and fetch helper
// ---------------------------------------------------------------------------

/** A single inspection result row for the requested date range. */
export interface QualityResultRow {
  process_order: string
  inspection_lot_id: string | null
  material_id: string
  material_name: string
  plant_id: string
  characteristic_id: string
  characteristic_description: string
  sample_id: string | null
  specification: string | null
  quantitative_result: number | null
  qualitative_result: string | null
  uom: string | null
  judgement: 'A' | 'R'
  result_date_ms: number
  usage_decision_code: string | null
  valuation_code: string | null
  quality_score: number | null
}

/** One entry in the 30-day daily quality series. */
export interface QualityDaySeries {
  date: number        // epoch ms, UTC midnight
  accepted: number
  rejected: number
  rft_pct: number | null   // right-first-time %; null for zero-result buckets
}

/** One entry in the 24-hour hourly quality series. */
export interface QualityHourSeries {
  hour: number        // epoch ms, UTC hour start
  accepted: number
  rejected: number
  rft_pct: number | null
}

/** Full quality analytics payload from POST /api/quality/analytics. */
export interface QualityData {
  now_ms: number
  materials: string[]          // distinct material_name values from rows
  rows: QualityResultRow[]
  prior7d: QualityResultRow[]
  daily30d: QualityDaySeries[]
  hourly24h: QualityHourSeries[]
}

/**
 * Fetch quality analytics from the backend.
 *
 * POSTs to `/api/quality/analytics` with an optional plant filter and date
 * range. When `date_from` / `date_to` are omitted the server defaults to the
 * last-24h rolling window. The response contains pre-aggregated daily (30-day)
 * and hourly (24h) series alongside the raw inspection result rows and a
 * 7-day prior-period comparison set.
 */
export async function fetchQualityAnalytics(params?: {
  plant_id?: string
  date_from?: string
  date_to?: string
}): Promise<QualityData> {
  const res = await fetch('/api/quality/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plant_id: params?.plant_id ?? null,
      date_from: params?.date_from ?? null,
      date_to: params?.date_to ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Quality analytics request failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<QualityData>
}
