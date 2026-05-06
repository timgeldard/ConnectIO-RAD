// ---------------------------------------------------------------------------
// Equipment Insights v2 — types and fetch helper
// ---------------------------------------------------------------------------

import { postJson } from './client'

/** One piece of production equipment in the estate. */
export interface EquipmentItem {
  id: string
  name: string
  type: string
  state: 'in_use' | 'dirty' | 'available' | 'unknown'
  line: string
  /** Average time to clean in minutes. */
  ttc_min: number
  /** Rolling 7-day utilisation percentage. */
  utilisation_pct: number
  /** Right-first-time percentage. */
  ftr_pct: number
  /** Mean time between cleans in hours. */
  mtbc_h: number
  /** Epoch ms of last clean. */
  last_clean_ms: number
  /** Days until calibration is due (negative = overdue). Null = no calibration required. */
  cal_due_days: number | null
  /** Faults raised in the last 7 days. */
  faults_7d: number
  /** Whether a statistical drift anomaly has been detected. */
  anomaly: boolean
  /** Criticality class: A = critical, B = important, C = standard. */
  criticality: 'A' | 'B' | 'C'
  /** Minutes since last use, if currently dirty. Null otherwise. */
  dirty_age_min: number | null
}

/** Per-type aggregation row for the equipment type breakdown table. */
export interface EquipmentTypeAgg {
  type: string
  count: number
  avg_ttc_min: number
  avg_util_pct: number
  /** Number of equipment items in this type currently in dirty state. */
  dirty: number
}

/** State distribution entry for the StateBar chart. */
export interface EquipmentStateAgg {
  state: string
  count: number
  pct: number
}

/** KPI summary values for the Equipment Insights v2 overview. */
export interface EquipmentInsights2Kpis {
  avg_ttc_min: number
  avg_ftr_pct: number
  avg_utilisation_pct: number
  dirty_count: number
  /** Dirty items that have been waiting more than 4 hours. */
  dirty_over_4h: number
  cal_overdue: number
  /** Calibrations due within the next 14 days. */
  cal_due_soon: number
  total_dirty_time_min: number
  anomaly_count: number
}

/** Full Equipment Insights v2 payload from POST /api/equipment-insights-v2/summary. */
export interface EquipmentInsights2Summary {
  kpis: EquipmentInsights2Kpis
  /** 14-day rolling average TTC trend (minutes per day). */
  ttc_trend: number[]
  /** 14-day rolling average FTR % trend. */
  ftr_trend: number[]
  state_agg: EquipmentStateAgg[]
  /** Activity heatmap: [day_index 0–6][hour_index 0–23] = % of equipment in use. */
  heatmap: number[][]
  type_agg: EquipmentTypeAgg[]
  /** Full equipment register. */
  equipment: EquipmentItem[]
  /** Dirty equipment sorted by dirty_age_min descending (oldest first). */
  cleaning_backlog: EquipmentItem[]
  /** Equipment with calibration due, sorted by cal_due_days ascending. */
  cal_register: EquipmentItem[]
  /** Equipment with detected anomalies. */
  anomalies: EquipmentItem[]
  /** Indicates if real gold data is available. If false, the frontend should render an empty state. */
  data_available?: boolean
  /** The reason data is not available, e.g., 'equipment_gold_views_pending'. */
  reason?: string
}

/**
 * Fetch Equipment Insights v2 summary.
 *
 * POSTs to `/api/equipment-insights-v2/summary`. Returns empty data until
 * the gold views for TTC, FTR, calibration status, and anomaly detection
 * are created in Unity Catalogue.
 *
 * @param params Optional plant filter.
 * @returns A promise resolving to the EquipmentInsights2Summary payload.
 * @throws Error if the request fails.
 */
export async function fetchEquipmentInsights2(params?: {
  plant_id?: string
}): Promise<EquipmentInsights2Summary> {
  return postJson<EquipmentInsights2Summary>(
    '/api/equipment-insights-v2/summary',
    {
      plant_id: params?.plant_id ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  )
}
