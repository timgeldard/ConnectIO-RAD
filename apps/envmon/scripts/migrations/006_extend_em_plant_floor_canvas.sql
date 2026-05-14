-- Adds canvas metadata and revision tracking columns to em_plant_floor.
-- Existing svg_url, svg_width, svg_height columns are untouched.
-- active_revision_id is nullable so pre-Studio floor rows are not broken.

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS canvas_type             STRING  COMMENT 'floor_plan | grid; defaults to floor_plan for existing rows';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS canvas_width            DOUBLE  COMMENT 'Canvas width in canvas_units; derived from svg_width for floor_plan rows';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS canvas_height           DOUBLE  COMMENT 'Canvas height in canvas_units; derived from svg_height for floor_plan rows';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS canvas_units            STRING  COMMENT 'pct | px; pct for floor_plan rows';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS grid_size               DOUBLE  COMMENT 'Grid cell size; only used when canvas_type = grid';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS scale_value             DOUBLE  COMMENT 'Real-world metres (or feet) per canvas unit';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS scale_units             STRING  COMMENT 'm | ft';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS background_image_url    STRING  COMMENT 'Replaces svg_url for new authoring; keeps svg_url intact for CoordinateMapper';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS background_image_type   STRING  COMMENT 'svg | png | jpg';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS background_checksum     STRING  COMMENT 'SHA-256 of the uploaded background file';

ALTER TABLE `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor`
    ADD COLUMN IF NOT EXISTS active_revision_id      STRING  COMMENT 'FK to em_layout_revision.revision_id; NULL until first Studio publish for this floor';
