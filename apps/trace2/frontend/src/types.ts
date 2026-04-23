export type BatchStatus =
  | "UNRESTRICTED"
  | "QUALITY_INSPECTION"
  | "Q_INSP"
  | "RESTRICTED"
  | "BLOCKED"
  | "RELEASED"
  | "IN_PROC";

export type ShelfLifeStatus =
  | "WITHIN_SHELF_LIFE"
  | "OK"
  | "Warning"
  | "Critical"
  | "Expired"
  | "UNKNOWN";

export interface Batch {
  material_id: string;
  material_name: string;
  material_desc40: string;
  batch_id: string;
  process_order: string;
  plant_id: string;
  plant_name: string;
  manufacture_date: string;
  expiry_date: string;
  days_to_expiry: number;
  shelf_life_status: ShelfLifeStatus;
  batch_status: BatchStatus;
  uom: string;
  qty_produced: number;
  qty_shipped: number;
  qty_consumed: number;
  qty_adjusted: number;
  current_stock: number;
  variance: number;
  mass_balance_kg: number;
  unrestricted: number;
  blocked: number;
  qi: number;
  transit: number;
  restricted: number;
  customers_affected: number;
  countries_affected: number;
  total_shipped_kg: number;
  total_deliveries: number;
  total_consumed: number;
  consuming_pos: number;
}

export interface CountryRow {
  code: string;
  name: string;
  qty: number;
  deliveries: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  country: string;
  qty: number;
  deliveries: number;
  share: number;
}

export type DeliveryStatus = "DELIVERED" | "IN_TRANSIT" | "PLANNED";

export interface Delivery {
  delivery: string;
  customer: string;
  destination: string;
  country: string;
  date: string;
  qty: number;
  status: DeliveryStatus;
  doc: string;
}

export type LinkType = "RECEIPT" | "INTERNAL" | "CONSUMPTION" | "SALES_ORDER";
export type LineageKind = "focal";

export interface FocalNode {
  id: string;
  material_id: string;
  material: string;
  batch_id: string;
  plant: string;
  qty: number;
  uom: string;
  kind: LineageKind;
}

export interface LineageNode {
  id: string;
  level: number;
  material_id: string;
  material: string;
  batch: string;
  plant: string;
  qty: number;
  uom: string;
  supplier?: string;
  customer?: string;
  link: LinkType;
  parent: string;
}

export interface Lineage {
  focal: FocalNode;
  upstream: LineageNode[];
  downstream: LineageNode[];
}

export interface MassBalanceEvent {
  date: string;
  event: string;
  delta: number;
  cum: number;
}

export interface InspectionLot {
  lot: string;
  type: string;
  start: string;
  end: string;
  qty: number;
  uom: string;
  decision: "ACCEPTED" | "REJECTED";
  insp_by: string;
  origin: string;
}

export interface MIC {
  id: string;
  name: string;
  target: string;
  tol: string;
  uom: string;
  value: string;
  qual: string;
  result: "ACCEPTED" | "REJECTED";
  critical: boolean;
}

export interface ProductionEntry {
  batch: string;
  po: string;
  plant: string;
  date: string;
  qty: number;
  status: BatchStatus;
  yield_pct: number;
}

export type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Supplier {
  id: string;
  name: string;
  country: string;
  material: string;
  received: number;
  batches: number;
  first: string;
  last: string;
  failure_rate: number;
  risk: Risk;
}

export interface ExposureRow {
  material_id: string;
  material: string;
  batch: string;
  plant: string;
  qty: number;
  stock: number;
  shipped: number;
  status: BatchStatus;
  path_depth: 1 | 2;
  risk: Risk;
}

export interface BatchCompareEntry extends ProductionEntry {
  lot_count: number;
  accepted: number;
  rejected: number;
  failed_mics: number;
}

export interface RecallEvent {
  date: string;
  category: "PRODUCTION" | "CONSUMPTION" | "SALES_ISSUE" | "ADJUSTMENT";
  type: string;
  plant: string;
  qty: number;
  uom: string;
  customer: string | null;
  country: string | null;
  doc: string;
}

export type Tweaks = {
  theme: "light" | "dark";
  density: "comfortable" | "compact";
  brandName: string;
};

export type DemoState = "default" | "qi" | "recall";

export type PageId =
  | "overview"
  | "mass_balance"
  | "bottom_up"
  | "top_down"
  | "customers_deliveries"
  | "quality"
  | "production_history"
  | "batch_comparison"
  | "supplier_risk"
  | "recall_readiness"
  | "coa";
