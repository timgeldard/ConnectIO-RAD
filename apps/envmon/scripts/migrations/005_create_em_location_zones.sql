CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_zones` (
    zone_id                  STRING     NOT NULL  COMMENT 'UUID for this zone',
    plant_id                 STRING     NOT NULL  COMMENT 'SAP 4-character plant code, e.g. P225',
    floor_id                 STRING     NOT NULL  COMMENT 'Short floor identifier, e.g. F1',
    functional_location_id   STRING               COMMENT 'SAP L4 functional location code',
    functional_location_level INT                 COMMENT 'Hierarchy level; expected 4 for L4 zones',
    zone_name                STRING     NOT NULL  COMMENT 'Human-readable zone label displayed in the studio',
    geometry_type            STRING     NOT NULL  COMMENT 'polygon | rectangle',
    geometry_json            STRING     NOT NULL  COMMENT 'Canonical geometry JSON (see docs/spatial-studio-implementation-plan.md)',
    bbox_json                STRING               COMMENT 'Bounding box: {"x_min_pct","y_min_pct","x_max_pct","y_max_pct"}',
    centroid_x               DOUBLE               COMMENT 'Zone centroid x in percentage coordinates (0–100)',
    centroid_y               DOUBLE               COMMENT 'Zone centroid y in percentage coordinates (0–100)',
    parent_zone_id           STRING               COMMENT 'FK to zone_id of parent zone; reserved for nested zones (future use)',
    revision_id              STRING     NOT NULL  COMMENT 'FK to em_layout_revision.revision_id',
    status                   STRING     NOT NULL  COMMENT 'draft | published | archived',
    created_by               STRING     NOT NULL  COMMENT 'Identity that created this zone',
    created_at               TIMESTAMP  NOT NULL  COMMENT 'Creation time (UTC)',
    updated_by               STRING     NOT NULL  COMMENT 'Identity that last updated this zone',
    updated_at               TIMESTAMP  NOT NULL  COMMENT 'Last modification time (UTC)',
    CONSTRAINT pk_em_location_zones PRIMARY KEY (zone_id)
)
USING DELTA
COMMENT 'EM App: L4 spatial zones for spatial studio (rectangles and polygons in pct coordinates)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'       = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact'   = 'true'
)
