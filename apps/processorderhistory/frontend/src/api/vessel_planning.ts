// ---------------------------------------------------------------------------
// Vessel planning analytics types and fetch helper
// ---------------------------------------------------------------------------

import { postJson } from './client'

/** Affinity entry: how many times a vessel has processed a given material. */
export interface VesselAffinityEntry {
  material_id: string
  material_name: string
  use_count: number
}

/** A released order that is blocked on this vessel being unavailable. */
export interface BlockedOrder {
  po_id: string
  material_name: string
  scheduled_start_ms: number | null
}

/** Live state of a single vessel (INSTRUMENT_ID in equipment history). */
export interface VesselInfo {
  instrument_id: string
  equipment_type: string | null
  /** Heuristic classification from latest STATUS_TO + running PO check. */
  state: 'IN_USE' | 'DIRTY' | 'AVAILABLE' | 'UNKNOWN'
  /** Human-readable explanation of why this state was assigned. */
  state_reason: string | null
  current_po_id: string | null
  current_material_id: string | null
  current_material_name: string | null
  /** Epoch ms of the most recent state-change event. */
  state_since_ms: number | null
  status_to: string | null
  status_from: string | null
  /** Top materials processed on this vessel, by historical event count. */
  affinity_materials: VesselAffinityEntry[]
  /** Released orders that would use this vessel but are currently blocked. */
  blocked_orders: BlockedOrder[]
  /** Count of blocked released orders (mirrors blocked_orders.length). */
  blocked_order_count: number
  /** Count of distinct materials this vessel has processed in the date range. */
  top_affinity_material_count: number
  recommended_action: string | null
  /** Human-readable explanation of why this action is recommended. */
  action_reason: string | null
  /** 1 = highest urgency (in-use with blocked orders), 2 = dirty, 3 = in-use no backlog. */
  action_priority: number | null
}

/** A released process order with feasibility, vessel recommendation, and structured evidence. */
export interface ReleasedOrder {
  po_id: string
  material_id: string | null
  material_name: string
  plant_id: string | null
  scheduled_start_ms: number | null
  /** 1-based priority rank (earliest scheduled start first). */
  rank: number
  feasible: boolean
  constraint_type: 'dirty_vessel' | 'in_use_vessel' | 'no_vessel' | null
  /** Vessel IDs ranked by affinity count for this material (after capacity filtering). */
  likely_vessels: string[]
  recommended_vessel: string | null
  recommendation: string | null
  heuristic_confidence: 'high' | 'medium' | 'low'
  /** Historical co-occurrence count for the recommended vessel and this material. */
  evidence_affinity_count: number
  /** 1-based rank of the recommended vessel in the full affinity list for this material. */
  evidence_affinity_rank: number | null
  /** Total number of vessels with any historical affinity for this material. */
  evidence_candidate_vessel_count: number
  /** Epoch ms of the most recent event where this material appeared on any vessel. */
  evidence_last_seen_at_ms: number | null
  /** Whether affinity history exists for this material. */
  evidence_source: 'affinity_history' | 'no_affinity_data'
  /** Structured notes explaining capacity validation status and other caveats. */
  evidence_notes: string[]
}

/** Summary counts for the KPI strip. */
export interface VesselKpis {
  released_po_count: number
  constrained_po_count: number
  available_vessel_count: number
  dirty_vessel_count: number
  in_use_vessel_count: number
  unknown_vessel_count: number
  unblock_action_count: number
}

/** Full vessel planning analytics payload from POST /api/vessel-planning/analytics. */
export interface VesselPlanningData {
  now_ms: number
  kpis: VesselKpis
  vessels: VesselInfo[]
  released_orders: ReleasedOrder[]
}

/**
 * Fetch vessel planning analytics: live vessel states and priority queue.
 *
 * @param params Optional filters for plant ID and date range (YYYY-MM-DD).
 * @returns A promise resolving to the VesselPlanningData payload.
 * @throws Error if the API request fails.
 */
export async function fetchVesselPlanningAnalytics(params?: {
  plantId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<VesselPlanningData> {
  return postJson<VesselPlanningData>(
    '/api/vessel-planning/analytics',
    {
      plant_id: params?.plantId ?? null,
      date_from: params?.dateFrom ?? null,
      date_to: params?.dateTo ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  )
}
