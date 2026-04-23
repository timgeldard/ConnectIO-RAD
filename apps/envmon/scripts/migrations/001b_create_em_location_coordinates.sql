CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates` (
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
)
