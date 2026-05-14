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
  /** FK to em_location_zones.zone_id — populated after Slice 1 migration. */
  parent_zone_id?: string | null;
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

/** Whether a floor uses a real floor-plan image or a procedural grid. */
export type CanvasType = 'floor_plan' | 'grid';
/** Zone geometry variant: freehand polygon or axis-aligned rectangle. */
export type ZoneGeometryType = 'polygon' | 'rectangle';
/** Lifecycle state of a layout revision row. */
export type RevisionState = 'draft' | 'published' | 'superseded' | 'rolled_back';
/** Severity of a layout validation finding. */
export type ValidationSeverity = 'blocking_error' | 'warning' | 'suggestion';
/** Active editing mode in the Spatial Studio authoring UI. */
export type StudioMode = 'structure' | 'place' | 'review';

/** Metadata describing how a floor's canvas is rendered in the Studio. */
export interface CanvasMetadata {
  /** Rendering strategy: image-backed or procedural grid. */
  canvasType: CanvasType;
  /** Logical canvas width (pixels or units); drives aspect ratio when set. */
  canvasWidth?: number;
  /** Logical canvas height (pixels or units); drives aspect ratio when set. */
  canvasHeight?: number;
  /** Unit label for display purposes (e.g. `'px'`, `'m'`). */
  canvasUnits?: string;
  /** Grid cell size in percentage units (grid canvas only). */
  gridSize?: number;
  /** Public URL of the floor plan background image (floor_plan canvas only). */
  backgroundImageUrl?: string;
  /** MIME type of the background image, e.g. `'image/svg+xml'`. */
  backgroundImageType?: string;
}

/** A single vertex of a polygon zone, expressed in percentage coordinates. */
export interface ZonePoint {
  /** Horizontal position, 0–100 (left to right). */
  x_pct: number;
  /** Vertical position, 0–100 (top to bottom). */
  y_pct: number;
}

/** Axis-aligned rectangle zone geometry in percentage coordinates. */
export interface RectangleGeometry {
  type: 'rectangle';
  /** Left edge position, 0–100. */
  x_pct: number;
  /** Top edge position, 0–100. */
  y_pct: number;
  /** Width in percentage units. */
  width_pct: number;
  /** Height in percentage units. */
  height_pct: number;
}

/** Freehand polygon zone geometry expressed as an ordered list of vertices. */
export interface PolygonGeometry {
  type: 'polygon';
  /** Ordered polygon vertices; must have ≥ 3 points to define a valid area. */
  points: ZonePoint[];
}

/** Union of all supported zone geometry variants. */
export type ZoneGeometry = RectangleGeometry | PolygonGeometry;

/** An L4 spatial zone within a floor layout revision. */
export interface LayoutZone {
  /** UUID assigned at zone creation. */
  zone_id: string;
  /** SAP plant code. */
  plant_id: string;
  /** Floor identifier. */
  floor_id: string;
  /** Human-readable zone label shown in the Studio and hierarchy rail. */
  zone_name: string;
  /** Discriminator matching the active variant of `geometry_json`. */
  geometry_type: ZoneGeometryType;
  /** Parsed geometry — use `geometry_type` to narrow the variant. */
  geometry_json: ZoneGeometry;
  /** SAP L4 functional location code linked to this zone, if any. */
  functional_location_id?: string;
  /** Revision this zone belongs to. */
  revision_id: string;
  /** Lifecycle state of this individual zone row. */
  status: 'draft' | 'published' | 'archived';
  /** Pre-computed centroid x (percentage), populated on save. */
  centroid_x?: number;
  /** Pre-computed centroid y (percentage), populated on save. */
  centroid_y?: number;
  /** JSON string of bounding-box extents for quick spatial queries. */
  bbox_json?: string;
}

/** A layout revision record tracking the full publish lifecycle for one floor. */
export interface LayoutRevision {
  /** UUID of this revision. */
  revision_id: string;
  /** SAP plant code. */
  plant_id: string;
  /** Floor identifier. */
  floor_id: string;
  /** Monotonically increasing version number for this floor. */
  revision_number: number;
  /** Current lifecycle state. */
  state: RevisionState;
  /** UUID of the revision this draft was branched from; absent for the first revision. */
  base_revision_id?: string;
  /** Reason for this layout change, required at publish time. */
  change_reason?: string;
  /** Identity (email) of the user who created this revision. */
  created_by: string;
  /** ISO-8601 UTC creation timestamp. */
  created_at: string;
  /** Identity of the user who published this revision; absent until published. */
  published_by?: string;
  /** ISO-8601 UTC publish timestamp; absent until published. */
  published_at?: string;
}

/** A single validation finding produced by the server-side layout validation pass. */
export interface ValidationIssue {
  /** Severity classification; blocking errors gate the publish action. */
  severity: ValidationSeverity;
  /** Machine-readable issue code, e.g. `'L5_OUTSIDE_PARENT_ZONE'`. */
  code: string;
  /** Human-readable description of the issue. */
  message: string;
  /** zone_id or func_loc_id that triggered this issue, when applicable. */
  subject_id?: string;
}

/** Aggregated result of validating a draft layout before publishing. */
export interface ValidationResult {
  /** All issues found, regardless of severity. */
  issues: ValidationIssue[];
  /** True when there are no blocking errors (safe to publish). */
  is_publishable: boolean;
}

/** Full draft layout payload returned by the Studio draft endpoint. */
export interface DraftLayout {
  /** The open draft revision record. */
  revision: LayoutRevision;
  /** All zones belonging to this draft revision. */
  zones: LayoutZone[];
  /** All L5 coordinates for this floor (mapped and unmapped). */
  coordinates: LocationMeta[];
}

/** Full published layout payload returned by the operational layout endpoint. */
export interface PublishedLayout {
  /** The active published revision, or null when the floor has never been through Studio. */
  revision: LayoutRevision | null;
  /** Zones from the active revision. */
  zones: LayoutZone[];
  /** L5 coordinates stamped with zone assignment and validation outcome. */
  coordinates: LocationMeta[];
}

/** Request body for the zone create/update endpoint (`PUT /spatial/floors/:floorId/zones`). */
export interface ZoneUpsertBody {
  /** When provided, updates the existing zone in-place; omit to create a new zone. */
  zone_id?: string;
  /** SAP plant code. */
  plant_id: string;
  /** Draft revision UUID that owns this zone. */
  revision_id: string;
  /** Human-readable zone label. */
  zone_name: string;
  /** Geometry variant discriminator. */
  geometry_type: ZoneGeometryType;
  /** Geometry data without the `type` discriminator field (server derives it). */
  geometry_json: Omit<ZoneGeometry, 'type'>;
  /** Optional SAP L4 functional location code to link to this zone. */
  functional_location_id?: string;
}

/** Request body for the publish layout endpoint (`POST /spatial/floors/:floorId/publish`). */
export interface PublishBody {
  /** SAP plant code. */
  plant_id: string;
  /** UUID of the draft revision to publish. */
  revision_id: string;
  /** Non-empty reason for this layout change, required by the publish guard. */
  change_reason: string;
}

/** Request body for the rollback endpoint (`POST /spatial/floors/:floorId/rollback`). */
export interface RollbackBody {
  /** SAP plant code. */
  plant_id: string;
  /** UUID of the previously published revision to roll back to. */
  target_revision_id: string;
  /** Reason for the rollback. */
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
