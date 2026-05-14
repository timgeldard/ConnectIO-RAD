-- Adds zone assignment, placement provenance, and validation state columns to em_location_coordinates.
-- Existing rows keep parent_zone_id = NULL (no forced backfill — see docs/spatial-studio-implementation-plan.md).

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`
    ADD COLUMN IF NOT EXISTS parent_zone_id           STRING  COMMENT 'FK to em_location_zones.zone_id; NULL for unassigned L5 points';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`
    ADD COLUMN IF NOT EXISTS placement_source         STRING  COMMENT 'manual | copied | migrated | imported — how this point was placed';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`
    ADD COLUMN IF NOT EXISTS revision_id              STRING  COMMENT 'FK to em_layout_revision.revision_id; NULL for pre-Studio points';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`
    ADD COLUMN IF NOT EXISTS validation_status        STRING  COMMENT 'ok | warning | error — last validation outcome for this point';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates`
    ADD COLUMN IF NOT EXISTS validation_messages_json STRING  COMMENT 'JSON array of validation issue descriptions';
