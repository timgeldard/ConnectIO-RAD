-- Recreate spc_query_audit with the schema that insert_spc_query_audit() in db.py uses.
-- The original migration 002 created a generic event-log schema that never matched the
-- INSERT code, causing every audit write to fail silently. Drop and recreate.

DROP TABLE IF EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`spc_query_audit`;

CREATE TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`spc_query_audit` (
  query_id      STRING    NOT NULL,
  endpoint      STRING    NOT NULL,
  material_id   STRING,
  mic_id        STRING,
  plant_id      STRING,
  row_count     INT       NOT NULL,
  duration_ms   BIGINT    NOT NULL,
  warehouse_id  STRING,
  user_identity STRING    NOT NULL,
  executed_at   TIMESTAMP NOT NULL
)
USING DELTA
CLUSTER BY (endpoint, executed_at);
