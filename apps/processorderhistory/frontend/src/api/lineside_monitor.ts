import { postJson } from './client'

/** Process order currently running or queued for a production line. */
export interface LinesideOrder {
  /** Unique process order identifier. */
  process_order_id: string
  /** Plant where the order is executed. */
  plant_id?: string
  /** Production line identifier. */
  line_id: string
  /** Current process order status. */
  status: string
  /** Material identifier being produced. */
  material_id?: string
  /** Human-readable material name. */
  material_name?: string
  /** Order start timestamp in Unix epoch milliseconds. */
  start_ms?: number
  /** Last recorded activity timestamp in Unix epoch milliseconds. */
  last_activity_ms?: number
}

/** Downtime event affecting a production line. */
export interface LinesideDowntime {
  /** Production line identifier. */
  line_id: string
  /** Related process order identifier, when available. */
  process_order_id?: string
  /** Downtime reason code from the source system. */
  reason_code?: string
  /** Human-readable downtime issue title. */
  issue_title?: string
  /** Downtime start timestamp in Unix epoch milliseconds. */
  start_ms?: number
  /** Downtime duration in seconds. */
  duration_s?: number
}

/** Current operating state for one production line. */
export interface LinesideLine {
  /** Production line identifier. */
  line_id: string
  /** Derived line state for wallboard display. */
  status: 'running' | 'blocked' | 'idle'
  /** Active order on the line, or null when idle. */
  current_order: LinesideOrder | null
  /** Next queued orders for the line. */
  next_orders: LinesideOrder[]
  /** Recent downtime events for the line. */
  downtime: LinesideDowntime[]
}

/** Line-side inventory available to production. */
export interface LinesideStock {
  /** Plant identifier. */
  plant_id: string
  /** Storage bin identifier. */
  bin_id: string
  /** Warehouse storage type. */
  storage_type?: string
  /** Material identifier. */
  material_id?: string
  /** Human-readable material name. */
  material_name?: string
  /** Available quantity. */
  available?: number
  /** Unit of measure for the available quantity. */
  uom?: string
}

/** Aggregated Lineside Monitor API response. */
export interface LinesideMonitorSummary {
  /** Key performance indicators for the production-floor wallboard. */
  kpis: {
    /** Number of lines currently running. */
    lines_active: number
    /** Number of active process orders. */
    orders_running: number
    /** Number of lines with current downtime. */
    blocked: number
    /** Number of upcoming orders awaiting staging or picks. */
    awaiting_picks: number
    /** Number of line-side stock rows returned. */
    lineside_materials: number
  }
  /** Current line cards shown on the wallboard. */
  lines: LinesideLine[]
  /** Recent active order and downtime activity. */
  activity: Array<LinesideOrder | LinesideDowntime>
  /** Current line-side stock rows. */
  lineside_stock: LinesideStock[]
  /** Whether live data was available from any source query. */
  data_available?: boolean
}

/**
 * Fetches the Lineside Monitor summary from the backend.
 *
 * @param params - Optional request filters.
 * @param params.plant_id - Plant identifier to filter results; null fetches all authorized plants.
 * @returns Promise resolving to the Lineside Monitor summary.
 */
export async function fetchLinesideMonitor(params?: { plant_id?: string | null }): Promise<LinesideMonitorSummary> {
  return postJson<LinesideMonitorSummary>('/api/lineside-monitor/summary', {
    plant_id: params?.plant_id ?? null,
  })
}
