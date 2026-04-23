-- Migration 001: add plant_id to em_location_coordinates + create em_plant_floor
--
-- Drops and recreates em_location_coordinates with a plant_id column so that
-- coordinate mappings are scoped per-plant rather than per-deployment.
--
-- Also creates em_plant_floor which stores per-plant floor definitions,
-- replacing the previous EM_FLOOR_CONFIG env-var approach.
--
-- Safe to run on a fresh UAT environment — both statements are CREATE IF NOT EXISTS
-- or DROP+CREATE. Existing coordinate data is intentionally not preserved.

-- Step 1: drop old single-plant coordinates table and recreate with plant_id
DROP TABLE IF EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`;

CREATE TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates` (
    plant_id     STRING     NOT NULL  COMMENT 'SAP 4-character plant code, e.g. P225',
    func_loc_id  STRING     NOT NULL  COMMENT 'SAP functional location code (TPLNR), e.g. Q225-0101-SEV3-Z0-72',
    floor_id     STRING     NOT NULL  COMMENT 'Floor identifier matching em_plant_floor.floor_id',
    x_pos        DOUBLE     NOT NULL  COMMENT 'Relative X position on the floor plan image (0.0–100.0 %)',
    y_pos        DOUBLE     NOT NULL  COMMENT 'Relative Y position on the floor plan image (0.0–100.0 %)',
    updated_by   STRING     NOT NULL  COMMENT 'Databricks identity who last saved these coordinates (CURRENT_USER())',
    updated_at   TIMESTAMP  NOT NULL  COMMENT 'Timestamp of last coordinate update (CURRENT_TIMESTAMP())'
)
USING DELTA
COMMENT 'EM App: SAP functional location → floor plan X/Y coordinate mapping (multi-plant)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'           = 'false',
    'delta.autoOptimize.optimizeWrite'     = 'true',
    'delta.autoOptimize.autoCompact'       = 'true'
);

-- Step 2: create em_plant_floor for per-plant floor configuration
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor` (
    plant_id     STRING     NOT NULL  COMMENT 'SAP 4-character plant code, e.g. P225',
    floor_id     STRING     NOT NULL  COMMENT 'Short floor identifier used in URLs and coordinates, e.g. F1',
    floor_name   STRING     NOT NULL  COMMENT 'Human-readable floor label, e.g. Ground Floor',
    svg_url      STRING               COMMENT 'Optional relative URL to the floor plan SVG, e.g. /assets/P225/F1.svg',
    svg_width    DOUBLE               COMMENT 'SVG viewBox width in pixels',
    svg_height   DOUBLE               COMMENT 'SVG viewBox height in pixels',
    sort_order   INT        NOT NULL  COMMENT 'Display order within a plant (ascending)',
    created_at   TIMESTAMP  NOT NULL  COMMENT 'When this floor was added'
)
USING DELTA
COMMENT 'EM App: per-plant floor plan configuration (replaces EM_FLOOR_CONFIG env var)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'           = 'false',
    'delta.autoOptimize.optimizeWrite'     = 'true',
    'delta.autoOptimize.autoCompact'       = 'true'
);
