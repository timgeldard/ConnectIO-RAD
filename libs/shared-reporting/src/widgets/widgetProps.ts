import { z } from 'zod'

/** Existing KPITone from shared-ui */
export const kpiToneSchema = z.enum(['ok', 'warn', 'risk', 'neutral'])

/** KPI Widget Props */
export const kpiWidgetPropsSchema = z.object({
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  tone: kpiToneSchema.optional(),
  icon: z.string().optional(), // IconName is effectively string
  delta: z.string().optional(),
  trend: z.enum(['up', 'down']).optional(),
  sparkline: z.array(z.number()).optional(),
  subtext: z.string().optional(),
  progressBar: z.number().min(0).max(100).optional(),
})

/** Trend Chart Widget Props */
export const trendPointSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const trendChartWidgetPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  points: z.array(trendPointSchema).optional(),
  valueLabel: z.string().optional(),
  height: z.number().optional(),
})

/** Bar Chart Widget Props */
export const barSeriesSchema = z.object({
  name: z.string(),
  data: z.array(z.number()),
  color: z.string().optional(),
})

export const barChartWidgetPropsSchema = z.object({
  categories: z.array(z.string()).optional(),
  series: z.array(barSeriesSchema).optional(),
  horizontal: z.boolean().optional(),
  valueLabel: z.string().optional(),
  height: z.number().optional(),
})

/** Pareto Chart Widget Props */
export const paretoItemSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const paretoChartWidgetPropsSchema = z.object({
  items: z.array(paretoItemSchema).optional(),
  valueLabel: z.string().optional(),
  cumulativeLabel: z.string().optional(),
  height: z.number().optional(),
})

/** SPC Control Chart Widget Props */
export const spcDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  excluded: z.boolean().optional(),
  signal: z.boolean().optional(),
})

export const spcControlLimitsSchema = z.object({
  ucl: z.number().optional(),
  cl: z.number().optional(),
  lcl: z.number().optional(),
  sigma1: z.number().optional(),
  sigma2: z.number().optional(),
})

export const spcControlChartWidgetPropsSchema = z.object({
  points: z.array(spcDataPointSchema).optional(),
  limits: spcControlLimitsSchema.optional(),
  valueLabel: z.string().optional(),
  height: z.number().optional(),
})

/** Drill Down Table Widget Props */
export const drillDownColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  width: z.number().optional(),
  align: z.enum(['left', 'right', 'center']).optional(),
})

export const drillDownTableWidgetPropsSchema = z.object({
  columns: z.array(drillDownColumnSchema).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  emptyMessage: z.string().optional(),
  maxHeight: z.number().optional(),
})

/** Combined Widget Props Schema */
export const widgetPropsSchemaRegistry = {
  kpi: kpiWidgetPropsSchema,
  trend: trendChartWidgetPropsSchema,
  bar: barChartWidgetPropsSchema,
  pareto: paretoChartWidgetPropsSchema,
  'spc-control': spcControlChartWidgetPropsSchema,
  'drill-down-table': drillDownTableWidgetPropsSchema,
} as const

export type WidgetType = keyof typeof widgetPropsSchemaRegistry

export type KpiWidgetProps = z.infer<typeof kpiWidgetPropsSchema>
export type TrendChartWidgetProps = z.infer<typeof trendChartWidgetPropsSchema>
export type BarChartWidgetProps = z.infer<typeof barChartWidgetPropsSchema>
export type ParetoChartWidgetProps = z.infer<typeof paretoChartWidgetPropsSchema>
export type SpcControlChartWidgetProps = z.infer<typeof spcControlChartWidgetPropsSchema>
export type DrillDownTableWidgetProps = z.infer<typeof drillDownTableWidgetPropsSchema>
