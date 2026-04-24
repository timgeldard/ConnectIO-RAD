CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_geo` (
    plant_id    STRING     NOT NULL  COMMENT 'SAP 4-character plant code, e.g. P225',
    lat         DOUBLE     NOT NULL  COMMENT 'WGS-84 latitude',
    lon         DOUBLE     NOT NULL  COMMENT 'WGS-84 longitude',
    updated_at  TIMESTAMP            COMMENT 'Last modification time (UTC)',
    updated_by  STRING               COMMENT 'Identity that last updated this record'
)
USING DELTA
COMMENT 'EM App: plant map pin coordinates — replaces epmplantconfiguration_zepm_plant_conf join'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'           = 'false',
    'delta.autoOptimize.optimizeWrite'     = 'true',
    'delta.autoOptimize.autoCompact'       = 'true'
)
