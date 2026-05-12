-- Composable dashboard storage — run once by a DBA who has been granted
-- ALL PRIVILEGES on the dashboards schema.
--
-- Replace ${CATALOG} with the target Unity Catalog name (e.g. connected_plant_uat).
-- The DASHBOARD_CATALOG / DASHBOARD_SCHEMA env vars in app.template.yaml must
-- match the catalog and schema used here.
--
-- Execute each statement individually via the Databricks SQL editor or the
-- Statement API — multi-statement batches are not supported.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. dashboard_definitions
--    One row per dashboard. Points to the current live version via
--    current_version_id. Config lives in dashboard_versions (model B).
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `${CATALOG}`.`dashboards`.`dashboard_definitions` (
  id                 STRING    NOT NULL  COMMENT 'UUID primary key',
  title              STRING    NOT NULL  COMMENT 'Display title (max 200 chars)',
  description        STRING              COMMENT 'Optional long description (max 2000 chars)',
  owner_email        STRING    NOT NULL  COMMENT 'Email of the user who created this dashboard',
  is_public          BOOLEAN   NOT NULL  DEFAULT false COMMENT 'When true any authenticated user can view',
  tags               STRING    NOT NULL  DEFAULT '[]' COMMENT 'JSON array of string tags',
  current_version_id STRING              COMMENT 'FK → dashboard_versions.id for the live config',
  is_deleted         BOOLEAN   NOT NULL  DEFAULT false COMMENT 'Soft-delete flag',
  created_at         TIMESTAMP NOT NULL  COMMENT 'UTC creation timestamp (ISO-8601 string stored via SQL INSERT)',
  updated_at         TIMESTAMP NOT NULL  COMMENT 'UTC last-modified timestamp'
)
USING DELTA
COMMENT 'Composable dashboard registry — metadata only, config in dashboard_versions';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. dashboard_versions
--    Append-only version history. Every save writes a new row.
--    Restore = copy a version row's config and point current_version_id here.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `${CATALOG}`.`dashboards`.`dashboard_versions` (
  id               STRING    NOT NULL  COMMENT 'UUID primary key',
  dashboard_id     STRING    NOT NULL  COMMENT 'FK → dashboard_definitions.id',
  version_num      INT       NOT NULL  COMMENT 'Monotonically increasing version counter per dashboard',
  config_json      STRING    NOT NULL  COMMENT 'Full ComposableDashboardConfig serialised as JSON',
  created_at       TIMESTAMP NOT NULL  COMMENT 'UTC timestamp of this version save',
  created_by_email STRING    NOT NULL  COMMENT 'Email of the user who created this version'
)
USING DELTA
COMMENT 'Append-only version history for composable dashboard configs';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. dashboard_shares
--    Explicit user-level shares. Public dashboards do not require a row here.
--    All shares are view-only for MVP; write access is always owner-only.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `${CATALOG}`.`dashboards`.`dashboard_shares` (
  id                 STRING    NOT NULL  COMMENT 'UUID primary key',
  dashboard_id       STRING    NOT NULL  COMMENT 'FK → dashboard_definitions.id',
  shared_with_email  STRING    NOT NULL  COMMENT 'Email of the user being granted view access',
  shared_by_email    STRING    NOT NULL  COMMENT 'Email of the owner who created the share',
  shared_at          TIMESTAMP NOT NULL  COMMENT 'UTC timestamp when the share was created'
)
USING DELTA
COMMENT 'Explicit view-access grants for composable dashboards';
