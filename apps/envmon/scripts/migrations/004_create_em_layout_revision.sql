CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_layout_revision` (
    revision_id                   STRING     NOT NULL  COMMENT 'UUID for this revision',
    plant_id                      STRING     NOT NULL  COMMENT 'SAP 4-character plant code, e.g. P225',
    floor_id                      STRING     NOT NULL  COMMENT 'Short floor identifier, e.g. F1',
    revision_number               INT        NOT NULL  COMMENT 'Monotonically increasing per (plant_id, floor_id)',
    state                         STRING     NOT NULL  COMMENT 'draft | published | superseded | rolled_back',
    base_revision_id              STRING               COMMENT 'revision_id this draft branched from; NULL for first revision',
    change_reason                 STRING               COMMENT 'Human-readable reason for change, required at publish time',
    publish_summary_json          STRING               COMMENT 'JSON blob: counts of zones, points, warnings at publish',
    validation_summary_json       STRING               COMMENT 'JSON blob: last validation result',
    created_by                    STRING     NOT NULL  COMMENT 'Identity (email or service principal) that created this revision',
    created_at                    TIMESTAMP  NOT NULL  COMMENT 'Creation time (UTC)',
    published_by                  STRING               COMMENT 'Identity that published this revision; NULL until published',
    published_at                  TIMESTAMP            COMMENT 'Publish time (UTC); NULL until published',
    rolled_back_from_revision_id  STRING               COMMENT 'Populated when state = rolled_back; points to the revision that was undone',
    CONSTRAINT pk_em_layout_revision PRIMARY KEY (revision_id)
)
USING DELTA
COMMENT 'EM App: spatial layout revision lifecycle (draft/publish/superseded/rolled_back)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'       = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact'   = 'true'
)
