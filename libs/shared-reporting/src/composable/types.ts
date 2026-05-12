/**
 * TypeScript types for the composable dashboarding system.
 *
 * Derived from the Zod schemas in `../schema/composable.ts` for runtime
 * validation, but re-exported here as plain types for use in component props
 * and the Zustand store where direct Zod inference would be verbose.
 */
import type { z } from 'zod'
import type {
  composableWidgetLayoutSchema,
  composableWidgetSchema,
  composableDashboardConfigSchema,
  dashboardSummarySchema,
  dashboardDetailSchema,
  dashboardShareSchema,
  dashboardShareListResponseSchema,
} from '../schema/composable'

export type ComposableWidgetLayout = z.infer<typeof composableWidgetLayoutSchema>
export type ComposableWidget = z.infer<typeof composableWidgetSchema>
export type ComposableDashboardConfig = z.infer<typeof composableDashboardConfigSchema>
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type DashboardDetail = z.infer<typeof dashboardDetailSchema>
export type DashboardShare = z.infer<typeof dashboardShareSchema>
export type DashboardShareListResponse = z.infer<typeof dashboardShareListResponseSchema>

/** Unique identifier for a dashboard or widget instance (UUID string). */
export type DashboardId = string
export type WidgetId = string

/** View-only or edit mode for the ComposableDashboard shell. */
export type DashboardMode = 'view' | 'edit'
