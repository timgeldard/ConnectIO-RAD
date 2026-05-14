/* eslint-disable jsdoc/require-jsdoc */
// ---------------------------------------------------------------------------
// Shared domain types — mirror backend Pydantic schemas
// ---------------------------------------------------------------------------

export type HeatmapStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NO_DATA' | 'WARNING';
export type HeatmapMode = 'deterministic' | 'continuous';
export type TimeWindow = 30 | 60 | 90 | 180 | 365 | 730;

export interface FloorInfo {
  floor_id: string;
  floor_name: string;
  location_count: number;
  svg_url: string | null;
  svg_width: number | null;
  svg_height: number | null;
}

export interface LocationMeta {
  func_loc_id: string;
  func_loc_name: string | null;
  plant_id: string;
  floor_id: string | null;
  x_pos: number | null;
  y_pos: number | null;
  is_mapped: boolean;
}

export interface MarkerData {
  func_loc_id: string;
  func_loc_name: string | null;
  floor_id: string;
  x_pos: number;
  y_pos: number;
  status: HeatmapStatus;
  fail_count: number;
  pass_count: number;
  pending_count: number;
  total_count: number;
  risk_score: number | null;
}

export interface HeatmapResponse {
  floor_id: string;
  mode: HeatmapMode;
  time_window_days: number;
  markers: MarkerData[];
}

export interface TrendPoint {
  inspection_date: string;
  mic_name: string;
  result_value: number | null;
  valuation: string | null;
  upper_limit: number | null;
  lower_limit: number | null;
}

export interface TrendResponse {
  func_loc_id: string;
  mic_name: string;
  window_days: number;
  points: TrendPoint[];
}

export interface InspectionLot {
  lot_id: string;
  func_loc_id: string;
  inspection_start_date: string | null;
  inspection_end_date: string | null;
  valuation: string | null;
  status: HeatmapStatus;
}

export interface MicResult {
  lot_id: string;
  mic_id: string;
  mic_name: string;
  result_value: number | null;
  valuation: string | null;
  upper_limit: number | null;
  lower_limit: number | null;
}

export interface LotDetailResponse {
  lot_id: string;
  mic_results: MicResult[];
}

export interface LocationSummary {
  meta: LocationMeta;
  mics: string[];
  recent_lots: InspectionLot[];
}

export interface CoordinateUpsertRequest {
  plant_id: string;
  func_loc_id: string;
  floor_id: string;
  x_pos: number;
  y_pos: number;
}

// ---------------------------------------------------------------------------
// Multi-plant portfolio
// ---------------------------------------------------------------------------

export interface PlantKpis {
  total_locs: number;
  active_fails: number;
  warnings: number;
  pending: number;
  pass_rate: number;
  lots_tested: number;
  lots_planned: number;
  risk_index: number;
  pathogen_hits: number;
}

export interface PlantInfo {
  plant_id: string;
  plant_name: string;
  plant_code: string;
  country: string;
  region: string;
  city: string;
  product: string;
  employees: number;
  lat: number;
  lon: number;
  floors: number;
  kpis: PlantKpis;
}

export type ViewLevel = 'global' | 'site' | 'floor' | 'admin';

export interface ViewState {
  level: ViewLevel;
  plantId: string | null;
  floorId: string | null;
}

export interface PlantGeoEntry {
  plant_id: string;
  lat: number;
  lon: number;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Spatial Studio — zones, revisions, validation (Slice 6+)
// ---------------------------------------------------------------------------

export type CanvasType = 'floor_plan' | 'grid';
export type ZoneGeometryType = 'polygon' | 'rectangle';
export type RevisionState = 'draft' | 'published' | 'superseded' | 'rolled_back';
export type ValidationSeverity = 'blocking_error' | 'warning' | 'suggestion';
export type StudioMode = 'structure' | 'place' | 'review';

export interface CanvasMetadata {
  canvasType: CanvasType;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasUnits?: string;
  gridSize?: number;
  backgroundImageUrl?: string;
  backgroundImageType?: string;
}

export interface ZonePoint {
  x_pct: number;
  y_pct: number;
}

export interface RectangleGeometry {
  type: 'rectangle';
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
}

export interface PolygonGeometry {
  type: 'polygon';
  points: ZonePoint[];
}

export type ZoneGeometry = RectangleGeometry | PolygonGeometry;

export interface LayoutZone {
  zone_id: string;
  plant_id: string;
  floor_id: string;
  zone_name: string;
  geometry_type: ZoneGeometryType;
  geometry_json: ZoneGeometry;
  functional_location_id?: string;
  revision_id: string;
  status: 'draft' | 'published' | 'archived';
  centroid_x?: number;
  centroid_y?: number;
  bbox_json?: string;
}

export interface LayoutRevision {
  revision_id: string;
  plant_id: string;
  floor_id: string;
  revision_number: number;
  state: RevisionState;
  base_revision_id?: string;
  change_reason?: string;
  created_by: string;
  created_at: string;
  published_by?: string;
  published_at?: string;
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  subject_id?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  is_publishable: boolean;
}

export interface DraftLayout {
  revision: LayoutRevision;
  zones: LayoutZone[];
  coordinates: LocationMeta[];
}

export interface PublishedLayout {
  /** null when the floor has never been published through Studio */
  revision: LayoutRevision | null;
  zones: LayoutZone[];
  coordinates: LocationMeta[];
}

export interface ZoneUpsertBody {
  /** When provided, updates the existing zone in-place; omit to create a new zone. */
  zone_id?: string;
  plant_id: string;
  revision_id: string;
  zone_name: string;
  geometry_type: ZoneGeometryType;
  geometry_json: Omit<ZoneGeometry, 'type'>;
  functional_location_id?: string;
}

export interface PublishBody {
  plant_id: string;
  revision_id: string;
  change_reason: string;
}

export interface RollbackBody {
  plant_id: string;
  target_revision_id: string;
  change_reason: string;
}

export type PersonaId = 'regional' | 'site' | 'sanitation' | 'auditor' | 'admin';

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  scope: string;
  initials: string;
  blurb: string;
  defaultView: ViewLevel;
}
