import type {
  Batch,
  BatchCompareEntry,
  BatchStatus,
  CountryRow,
  CustomerRow,
  Delivery,
  DeliveryStatus,
  ExposureRow,
  FocalNode,
  InspectionLot,
  LineageNode,
  MassBalanceEvent,
  MIC,
  ProductionEntry,
  RecallEvent,
  Risk,
  Supplier,
} from "../types";

export function focalIdFor(materialId: string, batchId: string): string {
  return `${materialId}|${batchId}`;
}

export function focalFromBatch(batch: Batch): FocalNode {
  return {
    id: focalIdFor(batch.material_id, batch.batch_id),
    material_id: batch.material_id,
    material: batch.material_name || batch.material_id,
    batch_id: batch.batch_id,
    plant: batch.plant_name || batch.plant_id || "",
    qty: batch.qty_produced || batch.total_shipped_kg || 0,
    uom: batch.uom || "KG",
    kind: "focal",
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    let detail: string;
    try {
      const json = await res.json();
      detail =
        typeof json.detail === "string"
          ? json.detail
          : JSON.stringify(json.detail ?? json);
    } catch {
      detail = `${res.status} ${res.statusText}`;
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

type Nullable<T> = T | null | undefined;
type NumLike = Nullable<string | number>;

function num(v: NumLike, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

function int(v: NumLike, fallback = 0): number {
  const n = num(v, fallback);
  return Math.round(n);
}

function str(v: Nullable<string>, fallback = ""): string {
  return v ?? fallback;
}

function asBatchStatus(s: Nullable<string>): BatchStatus {
  const v = (s ?? "").toUpperCase();
  if (["UNRESTRICTED", "QUALITY_INSPECTION", "Q_INSP", "RESTRICTED", "BLOCKED", "RELEASED", "IN_PROC"].includes(v))
    return v as BatchStatus;
  return "UNRESTRICTED";
}

function asRisk(s: Nullable<string>): Risk {
  const v = (s ?? "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(v)) return v as Risk;
  return "LOW";
}

function asDeliveryStatus(s: Nullable<string>): DeliveryStatus {
  const v = (s ?? "").toUpperCase();
  if (v === "DELIVERED" || v === "IN_TRANSIT" || v === "PLANNED") return v;
  return "DELIVERED";
}

function formatDate(iso: Nullable<string>): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(fromIso: Nullable<string>, toIso: Nullable<string>): number {
  if (!fromIso || !toIso) return 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Shared header mapping
// ---------------------------------------------------------------------------

interface RawHeader {
  material_id: string;
  batch_id: string;
  material_name: Nullable<string>;
  material_desc40: Nullable<string>;
  process_order: Nullable<string>;
  plant_id: Nullable<string>;
  plant_name: Nullable<string>;
  manufacture_date: Nullable<string>;
  expiry_date: Nullable<string>;
  days_to_expiry: NumLike;
  shelf_life_status: Nullable<string>;
  uom: Nullable<string>;
  qty_produced: NumLike;
  qty_shipped: NumLike;
  qty_consumed: NumLike;
  qty_adjusted: NumLike;
  current_stock: NumLike;
  unrestricted: NumLike;
  blocked: NumLike;
  qi: NumLike;
  restricted: NumLike;
  transit: NumLike;
  customers_affected: NumLike;
  countries_affected: NumLike;
  total_shipped_kg: NumLike;
  total_deliveries: NumLike;
  consuming_pos: NumLike;
  batch_status: Nullable<string>;
}

const SHELF_LIFE_VALUES = ["WITHIN_SHELF_LIFE", "OK", "Warning", "Critical", "Expired", "UNKNOWN"] as const;

function asShelfLifeStatus(s: Nullable<string>): Batch["shelf_life_status"] {
  const v = (s ?? "").trim();
  if ((SHELF_LIFE_VALUES as readonly string[]).includes(v)) {
    return v as Batch["shelf_life_status"];
  }
  return "UNKNOWN";
}

function buildBatch(header: RawHeader): Batch {
  const mfgIso = header.manufacture_date;
  const expIso = header.expiry_date;
  let daysToExpiry = int(header.days_to_expiry);
  if (!daysToExpiry && expIso) {
    daysToExpiry = daysBetween(new Date().toISOString().slice(0, 10), expIso);
  }
  const produced = num(header.qty_produced);
  const shipped = num(header.qty_shipped);
  const consumed = num(header.qty_consumed);
  const adjusted = num(header.qty_adjusted);
  const currentStock = num(header.current_stock);

  return {
    material_id: header.material_id ?? "",
    material_name: str(header.material_name, header.material_id ?? ""),
    material_desc40: str(header.material_desc40, str(header.material_name, header.material_id ?? "")),
    batch_id: header.batch_id ?? "",
    process_order: str(header.process_order),
    plant_id: str(header.plant_id),
    plant_name: str(header.plant_name, str(header.plant_id)),
    manufacture_date: formatDate(mfgIso),
    expiry_date: formatDate(expIso),
    days_to_expiry: daysToExpiry,
    shelf_life_status: asShelfLifeStatus(header.shelf_life_status),
    batch_status: asBatchStatus(header.batch_status),
    uom: str(header.uom, "KG"),
    qty_produced: produced,
    qty_shipped: shipped,
    qty_consumed: consumed,
    qty_adjusted: adjusted,
    current_stock: currentStock,
    variance: 0,
    mass_balance_kg: produced,
    unrestricted: num(header.unrestricted),
    blocked: num(header.blocked),
    qi: num(header.qi),
    transit: num(header.transit),
    restricted: num(header.restricted),
    customers_affected: int(header.customers_affected),
    countries_affected: int(header.countries_affected),
    total_shipped_kg: num(header.total_shipped_kg),
    total_deliveries: int(header.total_deliveries),
    total_consumed: consumed,
    consuming_pos: int(header.consuming_pos),
  };
}

function requireHeader(raw: { header: RawHeader | null }, materialId: string, batchId: string): RawHeader {
  if (!raw.header) {
    throw new ApiError(404, `No data for ${materialId} / ${batchId}`);
  }
  return raw.header;
}

// ---------------------------------------------------------------------------
// Recall readiness
// ---------------------------------------------------------------------------

interface RawCountry { code: Nullable<string>; name: Nullable<string>; qty: NumLike; deliveries: NumLike; }
interface RawCustomer { id: Nullable<string>; name: Nullable<string>; country: Nullable<string>; qty: NumLike; deliveries: NumLike; share: NumLike; }
interface RawDelivery { delivery: Nullable<string>; customer: Nullable<string>; destination: Nullable<string>; country: Nullable<string>; date: Nullable<string>; qty: NumLike; doc: Nullable<string>; status: Nullable<string>; }
interface RawExposure { material_id: Nullable<string>; material: Nullable<string>; batch: Nullable<string>; plant: Nullable<string>; qty: NumLike; stock: NumLike; shipped: NumLike; status: Nullable<string>; path_depth: NumLike; risk: Nullable<string>; }
interface RawEvent { date: Nullable<string>; category: Nullable<string>; type: Nullable<string>; plant: Nullable<string>; qty: NumLike; uom: Nullable<string>; customer: Nullable<string>; country: Nullable<string>; doc: Nullable<string>; }

interface RawRecallReadiness {
  header: RawHeader | null;
  countries: RawCountry[];
  customers: RawCustomer[];
  deliveries: RawDelivery[];
  exposure: RawExposure[];
  events: RawEvent[];
}

export interface RecallReadinessPayload {
  batch: Batch;
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
  exposure: ExposureRow[];
  events: RecallEvent[];
}

function mapCountry(c: RawCountry): CountryRow {
  return {
    code: str(c.code),
    name: str(c.name, str(c.code)),
    qty: num(c.qty),
    deliveries: int(c.deliveries),
  };
}

function mapCustomer(c: RawCustomer): CustomerRow {
  return {
    id: str(c.id),
    name: str(c.name, str(c.id)),
    country: str(c.country),
    qty: num(c.qty),
    deliveries: int(c.deliveries),
    share: num(c.share),
  };
}

function mapDelivery(d: RawDelivery): Delivery {
  return {
    delivery: str(d.delivery),
    customer: str(d.customer),
    destination: str(d.destination),
    country: str(d.country),
    date: formatDate(d.date),
    qty: num(d.qty),
    status: asDeliveryStatus(d.status),
    doc: str(d.doc),
  };
}

function mapExposure(e: RawExposure): ExposureRow {
  const depthNum = int(e.path_depth, 1);
  const depth = (depthNum === 2 ? 2 : 1) as 1 | 2;
  return {
    material_id: str(e.material_id),
    material: str(e.material),
    batch: str(e.batch),
    plant: str(e.plant),
    qty: num(e.qty),
    stock: num(e.stock),
    shipped: num(e.shipped),
    status: asBatchStatus(e.status),
    path_depth: depth,
    risk: asRisk(e.risk),
  };
}

function mapEvent(ev: RawEvent): RecallEvent {
  const cat = (ev.category ?? "").toUpperCase();
  const category: RecallEvent["category"] =
    cat === "PRODUCTION" || cat === "CONSUMPTION" || cat === "SALES_ISSUE" || cat === "ADJUSTMENT"
      ? cat
      : "ADJUSTMENT";
  return {
    date: formatDate(ev.date),
    category,
    type: str(ev.type),
    plant: str(ev.plant),
    qty: num(ev.qty),
    uom: str(ev.uom, "KG"),
    customer: ev.customer ?? null,
    country: ev.country ?? null,
    doc: str(ev.doc),
  };
}

export async function fetchRecallReadiness(
  material_id: string,
  batch_id: string,
): Promise<RecallReadinessPayload> {
  const raw = await postJson<RawRecallReadiness>("/api/recall-readiness", { material_id, batch_id });
  const header = requireHeader(raw, material_id, batch_id);
  return {
    batch: buildBatch(header),
    countries: (raw.countries ?? []).map(mapCountry),
    customers: (raw.customers ?? []).map(mapCustomer),
    deliveries: (raw.deliveries ?? []).map(mapDelivery),
    exposure: (raw.exposure ?? []).map(mapExposure),
    events: (raw.events ?? []).map(mapEvent),
  };
}

// ---------------------------------------------------------------------------
// CoA
// ---------------------------------------------------------------------------

interface RawCoaResult {
  mic_code: Nullable<string>;
  mic_name: Nullable<string>;
  target_value: NumLike;
  tolerance_range: Nullable<string>;
  actual_result: NumLike;
  result_status: Nullable<string>;
  within_spec: Nullable<boolean>;
  deviation_from_target: NumLike;
}

export interface CoaPayload {
  batch: Batch;
  mics: MIC[];
}

function mapCoa(r: RawCoaResult, idx: number): MIC {
  const target = num(r.target_value);
  const actual = num(r.actual_result);
  const tolText = str(r.tolerance_range);
  const code = str(r.mic_code, `MIC-${idx}`);
  const passed = r.within_spec === true || r.result_status === "A";
  return {
    id: code,
    name: str(r.mic_name, code),
    target: target === 0 && r.target_value === null ? "—" : String(target),
    tol: tolText,
    uom: "",
    value: r.actual_result === null ? "" : String(actual),
    qual: r.result_status === "A" ? "Pass" : r.result_status === "R" ? "Fail" : "",
    result: passed ? "ACCEPTED" : "REJECTED",
    critical: false,
  };
}

export async function fetchCoa(material_id: string, batch_id: string): Promise<CoaPayload> {
  const raw = await postJson<{ header: RawHeader | null; results: RawCoaResult[] }>("/api/coa", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  return {
    batch: buildBatch(header),
    mics: (raw.results ?? []).map(mapCoa),
  };
}

// ---------------------------------------------------------------------------
// Mass balance
// ---------------------------------------------------------------------------

interface RawMassBalanceEvent {
  date: Nullable<string>;
  category: Nullable<string>;
  type: Nullable<string>;
  delta: NumLike;
  cum: NumLike;
}

export interface MassBalancePayload {
  batch: Batch;
  events: MassBalanceEvent[];
}

function mapMassBalance(e: RawMassBalanceEvent): MassBalanceEvent {
  const label =
    e.category === "Production"
      ? `GR Production (${str(e.type)})`
      : e.category === "Shipment"
      ? `Sales issue (${str(e.type)})`
      : e.category && e.category.startsWith("Other")
      ? `Movement (${str(e.type)})`
      : str(e.category) + (e.type ? ` (${str(e.type)})` : "");
  return {
    date: formatDate(e.date),
    event: label,
    delta: num(e.delta),
    cum: num(e.cum),
  };
}

export async function fetchMassBalance(material_id: string, batch_id: string): Promise<MassBalancePayload> {
  const raw = await postJson<{ header: RawHeader | null; events: RawMassBalanceEvent[] }>("/api/mass-balance", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  return {
    batch: buildBatch(header),
    events: (raw.events ?? []).map(mapMassBalance),
  };
}

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

interface RawQualityLot {
  lot: Nullable<string>;
  inspection_type: Nullable<string>;
  description: Nullable<string>;
  start: Nullable<string>;
  end: Nullable<string>;
  inspector: Nullable<string>;
  origin: Nullable<string>;
  decision: Nullable<string>;
}

interface RawQualityResult {
  lot: Nullable<string>;
  mic_id: Nullable<string>;
  mic_code: Nullable<string>;
  mic_name: Nullable<string>;
  target_value: NumLike;
  upper_tol: NumLike;
  lower_tol: NumLike;
  tolerance_text: Nullable<string>;
  uom: Nullable<string>;
  quantitative_result: NumLike;
  qualitative_result: Nullable<string>;
  valuation: Nullable<string>;
  sample_id: Nullable<string>;
  method: Nullable<string>;
}

interface RawQualitySummary {
  lot_count: NumLike;
  accepted_result_count: NumLike;
  rejected_result_count: NumLike;
  failed_mic_count: NumLike;
  latest_inspection_date: Nullable<string>;
}

export interface QualityResult extends MIC {
  lot: string;
}

export interface QualityPayload {
  batch: Batch;
  lots: InspectionLot[];
  results: QualityResult[];
  summary: {
    lot_count: number;
    accepted_result_count: number;
    rejected_result_count: number;
    failed_mic_count: number;
    latest_inspection_date: string;
  };
}

function mapLot(l: RawQualityLot): InspectionLot {
  const qty = 0;
  const decisionText = str(l.decision).toUpperCase();
  const decision: InspectionLot["decision"] =
    decisionText.includes("REJECT") || decisionText.includes("R") ? "ACCEPTED" : "ACCEPTED";
  return {
    lot: str(l.lot),
    type: `${str(l.inspection_type)}${l.description ? ` / ${str(l.description)}` : ""}`,
    start: formatDate(l.start),
    end: formatDate(l.end),
    qty,
    uom: "KG",
    decision,
    insp_by: str(l.inspector),
    origin: str(l.origin),
  };
}

function mapQualityResult(r: RawQualityResult): QualityResult {
  const target = r.target_value === null ? null : num(r.target_value);
  const upper = r.upper_tol === null ? null : num(r.upper_tol);
  const lower = r.lower_tol === null ? null : num(r.lower_tol);
  const quant = r.quantitative_result === null ? null : num(r.quantitative_result);
  const tolStr =
    upper !== null && lower !== null
      ? `±${((upper - lower) / 2).toFixed(2)}`
      : str(r.tolerance_text);
  const valuation = str(r.valuation).toUpperCase();
  const result: MIC["result"] = valuation === "A" ? "ACCEPTED" : valuation === "R" ? "REJECTED" : "ACCEPTED";
  const micCode = str(r.mic_code, str(r.mic_id));
  return {
    id: micCode,
    name: str(r.mic_name, micCode),
    target: target === null ? "—" : String(target),
    tol: tolStr,
    uom: str(r.uom),
    value: quant === null ? "" : String(quant),
    qual: str(r.qualitative_result),
    result,
    critical: false,
    lot: str(r.lot),
  };
}

export async function fetchQuality(material_id: string, batch_id: string): Promise<QualityPayload> {
  const raw = await postJson<{
    header: RawHeader | null;
    lots: RawQualityLot[];
    results: RawQualityResult[];
    summary: RawQualitySummary | null;
  }>("/api/quality", { material_id, batch_id });
  const header = requireHeader(raw, material_id, batch_id);
  const s = raw.summary;
  return {
    batch: buildBatch(header),
    lots: (raw.lots ?? []).map(mapLot),
    results: (raw.results ?? []).map(mapQualityResult),
    summary: {
      lot_count: int(s?.lot_count),
      accepted_result_count: int(s?.accepted_result_count),
      rejected_result_count: int(s?.rejected_result_count),
      failed_mic_count: int(s?.failed_mic_count),
      latest_inspection_date: formatDate(s?.latest_inspection_date),
    },
  };
}

// ---------------------------------------------------------------------------
// Production history / Batch compare
// ---------------------------------------------------------------------------

interface RawProdBatch {
  process_order: Nullable<string>;
  batch_id: Nullable<string>;
  plant_id: Nullable<string>;
  date: Nullable<string>;
  qty: NumLike;
  uom: Nullable<string>;
  quality_status: Nullable<string>;
}

interface RawCompareBatch extends RawProdBatch {
  lot_count: NumLike;
  accepted: NumLike;
  rejected: NumLike;
  failed_mics: NumLike;
}

export interface ProductionHistoryPayload {
  batch: Batch;
  batches: ProductionEntry[];
}

export interface BatchComparePayload {
  batch: Batch;
  batches: BatchCompareEntry[];
}

function statusFromQuality(s: Nullable<string>, fallback: BatchStatus = "RELEASED"): BatchStatus {
  const v = (s ?? "").toLowerCase();
  if (v.includes("pass") || v.includes("released")) return "RELEASED";
  if (v.includes("reject") || v.includes("block")) return "BLOCKED";
  if (v.includes("hold") || v.includes("inspect")) return "Q_INSP";
  if (v === "") return fallback;
  return fallback;
}

function yieldPct(qty: number, avgQty: number): number {
  if (!avgQty) return 100;
  return (qty / avgQty) * 100;
}

function mapProd(p: RawProdBatch, avgQty: number): ProductionEntry {
  const qty = num(p.qty);
  return {
    batch: str(p.batch_id),
    po: str(p.process_order),
    plant: str(p.plant_id),
    date: formatDate(p.date),
    qty,
    status: statusFromQuality(p.quality_status),
    yield_pct: yieldPct(qty, avgQty),
  };
}

export async function fetchProductionHistory(material_id: string, batch_id: string): Promise<ProductionHistoryPayload> {
  const raw = await postJson<{ header: RawHeader | null; batches: RawProdBatch[] }>("/api/production-history", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  const rows = raw.batches ?? [];
  const total = rows.reduce((s, r) => s + num(r.qty), 0);
  const avg = rows.length ? total / rows.length : 0;
  return {
    batch: buildBatch(header),
    batches: rows.map((r) => mapProd(r, avg)),
  };
}

export async function fetchBatchCompare(material_id: string, batch_id: string): Promise<BatchComparePayload> {
  const raw = await postJson<{ header: RawHeader | null; batches: RawCompareBatch[] }>("/api/batch-compare", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  const rows = raw.batches ?? [];
  const total = rows.reduce((s, r) => s + num(r.qty), 0);
  const avg = rows.length ? total / rows.length : 0;
  return {
    batch: buildBatch(header),
    batches: rows.map((r) => ({
      ...mapProd(r, avg),
      lot_count: int(r.lot_count),
      accepted: int(r.accepted),
      rejected: int(r.rejected),
      failed_mics: int(r.failed_mics),
    })),
  };
}

// ---------------------------------------------------------------------------
// Bottom-up / Top-down lineage
// ---------------------------------------------------------------------------

interface RawLineageRow {
  level: NumLike;
  material_id: Nullable<string>;
  material: Nullable<string>;
  batch: Nullable<string>;
  plant: Nullable<string>;
  qty: NumLike;
  uom: Nullable<string>;
  supplier?: Nullable<string>;
  customer?: Nullable<string>;
  link: Nullable<string>;
  parent_material_id: Nullable<string>;
  parent_batch_id: Nullable<string>;
}

export interface BottomUpPayload {
  batch: Batch;
  lineage: LineageNode[];
}

export interface TopDownPayload {
  batch: Batch;
  lineage: LineageNode[];
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
}

function mapLineage(row: RawLineageRow, focalId: string): LineageNode {
  const level = Math.max(1, int(row.level, 1));
  const link = (str(row.link).toUpperCase() as LineageNode["link"]) || "INTERNAL";
  const parentMat = str(row.parent_material_id);
  const parentBatch = str(row.parent_batch_id);
  const isTopLevel = !parentMat || !parentBatch;
  return {
    id: `${str(row.material_id)}|${str(row.batch)}`,
    level,
    material_id: str(row.material_id),
    material: str(row.material, str(row.material_id)),
    batch: str(row.batch),
    plant: str(row.plant),
    qty: num(row.qty),
    uom: str(row.uom, "KG"),
    supplier: row.supplier ? str(row.supplier) : undefined,
    customer: row.customer ? str(row.customer) : undefined,
    link: (["RECEIPT", "INTERNAL", "CONSUMPTION", "SALES_ORDER"] as const).includes(link as any)
      ? (link as LineageNode["link"])
      : "INTERNAL",
    parent: isTopLevel ? focalId : `${parentMat}|${parentBatch}`,
  };
}

export async function fetchBottomUp(material_id: string, batch_id: string): Promise<BottomUpPayload> {
  const raw = await postJson<{ header: RawHeader | null; lineage: RawLineageRow[] }>("/api/bottom-up", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  const focalId = `${material_id}|${batch_id}|0`;
  return {
    batch: buildBatch(header),
    lineage: (raw.lineage ?? []).map((r) => mapLineage(r, focalId)),
  };
}

export async function fetchTopDown(material_id: string, batch_id: string): Promise<TopDownPayload> {
  const raw = await postJson<{
    header: RawHeader | null;
    lineage: RawLineageRow[];
    countries: RawCountry[];
    customers: RawCustomer[];
    deliveries: RawDelivery[];
  }>("/api/top-down", { material_id, batch_id });
  const header = requireHeader(raw, material_id, batch_id);
  const focalId = `${material_id}|${batch_id}|0`;
  return {
    batch: buildBatch(header),
    lineage: (raw.lineage ?? []).map((r) => mapLineage(r, focalId)),
    countries: (raw.countries ?? []).map(mapCountry),
    customers: (raw.customers ?? []).map(mapCustomer),
    deliveries: (raw.deliveries ?? []).map(mapDelivery),
  };
}

// ---------------------------------------------------------------------------
// Supplier risk
// ---------------------------------------------------------------------------

interface RawSupplier {
  id: Nullable<string>;
  name: Nullable<string>;
  country: Nullable<string>;
  material: Nullable<string>;
  received: NumLike;
  batches: NumLike;
  first: Nullable<string>;
  last: Nullable<string>;
  failure_rate: NumLike;
  accepted_results?: NumLike;
  rejected_results?: NumLike;
  failed_mics?: NumLike;
}

export interface SupplierRiskPayload {
  batch: Batch;
  suppliers: Supplier[];
}

function mapSupplier(s: RawSupplier): Supplier {
  const rate = num(s.failure_rate);
  const risk: Risk = rate >= 0.3 ? "HIGH" : rate >= 0.1 ? "MEDIUM" : "LOW";
  return {
    id: str(s.id),
    name: str(s.name, str(s.id)),
    country: str(s.country),
    material: str(s.material),
    received: num(s.received),
    batches: int(s.batches),
    first: formatDate(s.first),
    last: formatDate(s.last),
    failure_rate: rate,
    risk,
  };
}

export async function fetchSupplierRisk(material_id: string, batch_id: string): Promise<SupplierRiskPayload> {
  const raw = await postJson<{ header: RawHeader | null; suppliers: RawSupplier[] }>("/api/supplier-risk", {
    material_id,
    batch_id,
  });
  const header = requireHeader(raw, material_id, batch_id);
  return {
    batch: buildBatch(header),
    suppliers: (raw.suppliers ?? []).map(mapSupplier),
  };
}
