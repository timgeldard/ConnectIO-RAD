/**
 * Zod schemas for the composable dashboarding system.
 *
 * These schemas are separate from the existing {@link dashboardConfigSchema}
 * (CSS-grid, colSpan/rowSpan layout) and must not be mixed with it. Composable
 * dashboards use react-grid-layout coordinates (x, y, w, h) and are stored
 * server-side in Unity Catalog Delta tables.
 */
import { z } from 'zod'

/** Grid position and size for a widget — maps directly to react-grid-layout layout props. */
export const composableWidgetLayoutSchema = z.object({
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).default(4),
  h: z.number().int().min(1).default(4),
  minW: z.number().int().min(1).default(2),
  minH: z.number().int().min(1).default(2),
})

/**
 * A single widget instance placed in a composable dashboard grid.
 * `type` must match a key in the active widget registry.
 * `props` is widget-type-specific configuration.
 * `data` is optional live data binding configuration.
 */
export const composableWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  layout: composableWidgetLayoutSchema.default({ x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 }),
  props: z.record(z.string(), z.unknown()).default({}),
  data: z.object({
    queryKey: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    mapping: z.record(z.string(), z.unknown()).optional(),
  }).nullable().optional(),
})

/**
 * Full composable dashboard configuration — layout settings plus all widget instances.
 * Serialised as JSON in `dashboard_versions.config_json` on the backend.
 */
export const composableDashboardConfigSchema = z.object({
  columns: z.number().int().min(1).max(24).default(12),
  rowHeight: z.number().int().min(20).default(80),
  widgets: z.array(composableWidgetSchema).default([]),
  globalFilters: z.array(z.record(z.string(), z.unknown())).default([]),
  autoRefreshSeconds: z.number().int().min(30).nullable().optional(),
})

/** Lightweight summary returned in list responses. */
export const dashboardSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  ownerEmail: z.string(),
  isPublic: z.boolean(),
  tags: z.array(z.string()),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Full dashboard record including the composable config. */
export const dashboardDetailSchema = dashboardSummarySchema.extend({
  config: composableDashboardConfigSchema,
})

/** Response envelope for GET /api/dashboards. */
export const dashboardListResponseSchema = z.object({
  dashboards: z.array(dashboardSummarySchema),
  total: z.number().int(),
})

/** Request body for POST /api/dashboards. */
export const createDashboardBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  config: composableDashboardConfigSchema.optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})

/** A single explicit share record. */
export const dashboardShareSchema = z.object({
  dashboardId: z.string(),
  sharedWithEmail: z.string(),
  sharedByEmail: z.string(),
  sharedAt: z.string(),
})

/** Response envelope for GET /api/dashboards/{id}/shares. */
export const dashboardShareListResponseSchema = z.object({
  shares: z.array(dashboardShareSchema),
  total: z.number().int(),
})

/** Request body for POST /api/dashboards/{id}/shares. */
export const shareRequestSchema = z.object({
  email: z.string().min(1).max(254),
})
