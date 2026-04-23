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
)
