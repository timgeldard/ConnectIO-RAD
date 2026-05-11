/* eslint-disable jsdoc/require-jsdoc */
import type { ReactNode } from 'react'
import type { z } from 'zod'
import type {
  dashboardConfigSchema,
  dataSourceConfigSchema,
  filterConfigSchema,
  filterValueSchema,
  interactionConfigSchema,
  widgetConfigSchema,
} from '../schema/config'

export type FilterValue = z.infer<typeof filterValueSchema>
export type FilterConfig = z.infer<typeof filterConfigSchema>
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>
export type InteractionConfig = z.infer<typeof interactionConfigSchema>
export type WidgetConfig = z.infer<typeof widgetConfigSchema>
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>

export type DashboardFilters = Record<string, FilterValue>

export interface WidgetRenderProps<TProps extends Record<string, unknown> = Record<string, unknown>> {
  config: WidgetConfig
  props: TProps
  data?: unknown
}

export type WidgetComponent<TProps extends Record<string, unknown> = Record<string, unknown>> = (
  props: WidgetRenderProps<TProps>
) => ReactNode
