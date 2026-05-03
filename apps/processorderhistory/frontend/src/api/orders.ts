// ---------------------------------------------------------------------------
// Order list types (consumed by OrderList)
// ---------------------------------------------------------------------------

import { fetchJson, postJson } from './client'

/** Shape consumed by OrderList and OrderDetail components. */
export interface Order {
  id: string
  lot: string | null
  product: { name: string; sku: string; category: string }
  status: string
  line: string | null
  shift: string | null
  operator: string | null
  actualQty: number | null
  targetQty: number | null
  yieldPct: number | null
  start: number | null        // epoch ms
  end: number | null          // epoch ms
  durationH: number | null
}

export interface OrderListResponse {
  orders: Order[]
  total: number
}

function mapOrder(raw: Record<string, unknown>): Order {
  const aq = raw.actual_qty
  const sm = raw.start_ms
  const dh = raw.duration_h
  return {
    id: String(raw.process_order_id ?? ''),
    lot: raw.inspection_lot_id != null ? String(raw.inspection_lot_id) : null,
    product: {
      name: raw.material_name != null ? String(raw.material_name) : String(raw.material_id ?? ''),
      sku: String(raw.material_id ?? ''),
      category: raw.material_category != null ? String(raw.material_category) : '—',
    },
    status: String(raw.status ?? 'released'),
    line: null,
    shift: null,
    operator: null,
    actualQty: aq != null ? Number(aq) : null,
    targetQty: null,
    yieldPct: null,
    start: sm != null ? Number(sm) : null,
    end: raw.end_ms != null ? Number(raw.end_ms) : null,
    durationH: dh != null ? Number(dh) : null,
  }
}

// ---------------------------------------------------------------------------
// Order detail types (consumed by OrderDetail)
// ---------------------------------------------------------------------------

export interface OrderHeader {
  processOrderId: string
  status: string
  rawStatus: string
  materialId: string
  materialName: string
  materialCategory: string | null
  plantId: string
  inspectionLotId: string | null
  batchId: string | null
  supplierBatchId: string | null
  manufactureDateMs: number | null
  expiryDateMs: number | null
}

export interface Phase {
  phaseId: string
  phaseDescription: string | null
  phaseText: string | null
  operationQuantity: number
  operationQuantityUom: string | null
  startUser: string | null
  endUser: string | null
  setupS: number
  machS: number
  cleanS: number
}

export interface MaterialSummary {
  materialId: string
  materialName: string | null
  batchId: string | null
  totalQty: number
  uom: string | null
}

export interface Movement {
  materialId: string
  materialName: string | null
  batchId: string | null
  movementType: string
  quantity: number
  uom: string | null
  storageId: string | null
  userName: string | null
  dateTimeOfEntry: number | null
}

export interface Comment {
  createdMs: number | null
  sender: string | null
  notes: string | null
  phaseId: string | null
}

export interface DowntimeRecord {
  startTimeMs: number | null
  durationS: number
  reasonCode: string | null
  subReasonCode: string | null
  issueType: string | null
  issueTitle: string | null
  operatorsComments: string | null
}

export interface EquipmentRecord {
  equipmentType: string | null
  instrumentId: string | null
  statusFrom: string | null
  statusTo: string | null
  changeAtMs: number | null
}

export interface Inspection {
  characteristicId: string
  characteristicDescription: string | null
  sampleId: string | null
  specification: string | null
  quantitativeResult: number | null
  qualitativeResult: string | null
  uom: string | null
  judgement: string
}

export interface UsageDecision {
  usageDecisionCode: string | null
  valuationCode: string | null
  qualityScore: number | null
  createdBy: string | null
  createdDateMs: number | null
}

export interface OrderDetailData {
  order: OrderHeader
  timeSummary: { setupS: number; machS: number; cleanS: number }
  movementSummary: { qtyIssuedKg: number | null; qtyReceivedKg: number | null }
  phases: Phase[]
  materials: MaterialSummary[]
  movements: Movement[]
  comments: Comment[]
  downtime: DowntimeRecord[]
  equipment: EquipmentRecord[]
  inspections: Inspection[]
  usageDecision: UsageDecision | null
}

// ---------------------------------------------------------------------------
// Order list fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a list of process order summaries for a specific plant.
 *
 * @param params Optional filters for plant ID and result limit.
 * @returns A promise resolving to the OrderListResponse payload.
 * @throws Error if the API request fails.
 */
export async function fetchOrders(params: {
  plantId?: string
  limit?: number
} = {}): Promise<OrderListResponse> {
  const data = await postJson<{ total?: unknown; orders?: Record<string, unknown>[] }>(
    '/api/orders',
    {
      plant_id: params.plantId ?? null,
      limit: params.limit ?? 2000,
    },
  )
  return {
    total: Number(data.total ?? 0),
    orders: (data.orders ?? []).map(mapOrder),
  }
}

// ---------------------------------------------------------------------------
// Order detail fetch
// ---------------------------------------------------------------------------

function n(v: unknown): number | null {
  return v != null ? Number(v) : null
}
function s(v: unknown): string | null {
  return v != null ? String(v) : null
}

function mapOrderHeader(raw: Record<string, unknown>): OrderHeader {
  return {
    processOrderId: String(raw.process_order_id ?? ''),
    status: String(raw.status ?? 'released'),
    rawStatus: String(raw.raw_status ?? ''),
    materialId: String(raw.material_id ?? ''),
    materialName: raw.material_name != null ? String(raw.material_name) : String(raw.material_id ?? ''),
    materialCategory: s(raw.material_category),
    plantId: String(raw.plant_id ?? ''),
    inspectionLotId: s(raw.inspection_lot_id),
    batchId: s(raw.batch_id),
    supplierBatchId: s(raw.supplier_batch_id),
    manufactureDateMs: n(raw.manufacture_date_ms),
    expiryDateMs: n(raw.expiry_date_ms),
  }
}

function mapPhase(raw: Record<string, unknown>): Phase {
  return {
    phaseId: String(raw.phase_id ?? ''),
    phaseDescription: s(raw.phase_description),
    phaseText: s(raw.phase_text),
    operationQuantity: n(raw.operation_quantity) ?? 0,
    operationQuantityUom: s(raw.operation_quantity_uom),
    startUser: s(raw.start_user),
    endUser: s(raw.end_user),
    setupS: n(raw.setup_s) ?? 0,
    machS: n(raw.mach_s) ?? 0,
    cleanS: n(raw.clean_s) ?? 0,
  }
}

function mapMaterialSummary(raw: Record<string, unknown>): MaterialSummary {
  return {
    materialId: String(raw.material_id ?? ''),
    materialName: s(raw.material_name),
    batchId: s(raw.batch_id),
    totalQty: n(raw.total_qty) ?? 0,
    uom: s(raw.uom),
  }
}

function mapMovement(raw: Record<string, unknown>): Movement {
  return {
    materialId: String(raw.material_id ?? ''),
    materialName: s(raw.material_name),
    batchId: s(raw.batch_id),
    movementType: String(raw.movement_type ?? ''),
    quantity: n(raw.quantity) ?? 0,
    uom: s(raw.uom),
    storageId: s(raw.storage_id),
    userName: s(raw.user_name),
    dateTimeOfEntry: n(raw.date_time_of_entry),
  }
}

function mapComment(raw: Record<string, unknown>): Comment {
  return {
    createdMs: n(raw.created_ms),
    sender: s(raw.sender),
    notes: s(raw.notes),
    phaseId: s(raw.phase_id),
  }
}

function mapDowntime(raw: Record<string, unknown>): DowntimeRecord {
  return {
    startTimeMs: n(raw.start_time_ms),
    durationS: n(raw.duration_s) ?? 0,
    reasonCode: s(raw.reason_code),
    subReasonCode: s(raw.sub_reason_code),
    issueType: s(raw.issue_type),
    issueTitle: s(raw.issue_title),
    operatorsComments: s(raw.operators_comments),
  }
}

function mapEquipment(raw: Record<string, unknown>): EquipmentRecord {
  return {
    equipmentType: s(raw.equipment_type),
    instrumentId: s(raw.instrument_id),
    statusFrom: s(raw.status_from),
    statusTo: s(raw.status_to),
    changeAtMs: n(raw.change_at_ms),
  }
}

function mapInspection(raw: Record<string, unknown>): Inspection {
  return {
    characteristicId: String(raw.characteristic_id ?? ''),
    characteristicDescription: s(raw.characteristic_description),
    sampleId: s(raw.sample_id),
    specification: s(raw.specification),
    quantitativeResult: n(raw.quantitative_result),
    qualitativeResult: s(raw.qualitative_result),
    uom: s(raw.uom),
    judgement: String(raw.judgement ?? 'R'),
  }
}

function mapUsageDecision(raw: Record<string, unknown>): UsageDecision {
  return {
    usageDecisionCode: s(raw.usage_decision_code),
    valuationCode: s(raw.valuation_code),
    qualityScore: n(raw.quality_score),
    createdBy: s(raw.created_by),
    createdDateMs: n(raw.created_date_ms),
  }
}

/**
 * Fetch full details for a specific process order by its ID.
 *
 * @param processOrderId The process order number (e.g., "1001234").
 * @returns A promise resolving to the OrderDetailData payload.
 * @throws Error if the API request fails or the order is not found.
 */
export async function fetchOrderDetail(processOrderId: string): Promise<OrderDetailData> {
  const data = await fetchJson<Record<string, unknown>>(`/api/orders/${encodeURIComponent(processOrderId)}`, {
    credentials: 'include',
  })
  const ts = (data.time_summary ?? {}) as Record<string, unknown>
  const ms = (data.movement_summary ?? {}) as Record<string, unknown>
  return {
    order: mapOrderHeader((data.order ?? {}) as Record<string, unknown>),
    timeSummary: {
      setupS: n(ts.setup_s) ?? 0,
      machS: n(ts.mach_s) ?? 0,
      cleanS: n(ts.clean_s) ?? 0,
    },
    movementSummary: {
      qtyIssuedKg: n(ms.qty_issued_kg),
      qtyReceivedKg: n(ms.qty_received_kg),
    },
    phases: ((data.phases ?? []) as Record<string, unknown>[]).map(mapPhase),
    materials: ((data.materials ?? []) as Record<string, unknown>[]).map(mapMaterialSummary),
    movements: ((data.movements ?? []) as Record<string, unknown>[]).map(mapMovement),
    comments: ((data.comments ?? []) as Record<string, unknown>[]).map(mapComment),
    downtime: ((data.downtime ?? []) as Record<string, unknown>[]).map(mapDowntime),
    equipment: ((data.equipment ?? []) as Record<string, unknown>[]).map(mapEquipment),
    inspections: ((data.inspections ?? []) as Record<string, unknown>[]).map(mapInspection),
    usageDecision: data.usage_decision != null
      ? mapUsageDecision(data.usage_decision as Record<string, unknown>)
      : null,
  }
}
