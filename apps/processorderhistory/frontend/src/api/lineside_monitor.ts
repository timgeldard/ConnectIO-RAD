import { postJson } from './client'

export interface LinesideOrder {
  process_order_id: string
  plant_id?: string
  line_id: string
  status: string
  material_id?: string
  material_name?: string
  start_ms?: number
  last_activity_ms?: number
}

export interface LinesideDowntime {
  line_id: string
  process_order_id?: string
  reason_code?: string
  issue_title?: string
  start_ms?: number
  duration_s?: number
}

export interface LinesideLine {
  line_id: string
  status: 'running' | 'blocked' | 'idle'
  current_order: LinesideOrder | null
  next_orders: LinesideOrder[]
  downtime: LinesideDowntime[]
}

export interface LinesideStock {
  plant_id: string
  bin_id: string
  storage_type?: string
  material_id?: string
  material_name?: string
  available?: number
  uom?: string
}

export interface LinesideMonitorSummary {
  kpis: {
    lines_active: number
    orders_running: number
    blocked: number
    awaiting_picks: number
    lineside_materials: number
  }
  lines: LinesideLine[]
  activity: Array<LinesideOrder | LinesideDowntime>
  lineside_stock: LinesideStock[]
  data_available?: boolean
}

export async function fetchLinesideMonitor(params?: { plant_id?: string | null }): Promise<LinesideMonitorSummary> {
  return postJson<LinesideMonitorSummary>('/api/lineside-monitor/summary', {
    plant_id: params?.plant_id ?? null,
  })
}
