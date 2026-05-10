import { z } from 'zod'

export const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  z.null(),
])

export const filterConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['plant', 'timeRange', 'material', 'status', 'custom']),
  defaultValue: filterValueSchema.optional(),
})

export const dataSourceConfigSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['static', 'api']),
  endpoint: z.string().optional(),
  queryKey: z.array(z.string()).optional(),
})

export const interactionConfigSchema = z.object({
  kind: z.enum(['navigate', 'filter', 'emit']),
  target: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const widgetConfigSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  dataSource: dataSourceConfigSchema.optional(),
  props: z.record(z.string(), z.unknown()).default({}),
  interactions: z.array(interactionConfigSchema).default([]),
  layout: z.object({
    colSpan: z.number().int().min(1).max(12).optional(),
    rowSpan: z.number().int().min(1).optional(),
  }).default({}),
})

export const dashboardConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  filters: z.array(filterConfigSchema).default([]),
  widgets: z.array(widgetConfigSchema).default([]),
  layout: z.object({
    columns: z.number().int().min(1).max(12).default(12),
    gap: z.number().int().min(0).default(16),
    minColumnWidth: z.number().int().min(50).optional(),
  }).default({ columns: 12, gap: 16 }),
})
