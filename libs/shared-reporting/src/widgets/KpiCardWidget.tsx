/* eslint-disable jsdoc/require-jsdoc */
import { KPI, type KPITone, type IconName } from '@connectio/shared-ui'
import type { WidgetRenderProps } from '../core/types'

/** Props accepted by KpiCardWidget; all fields are optional and merge with runtime data. */
export interface KpiCardWidgetProps extends Record<string, unknown> {
  /** Display label shown below the value. */
  label?: string
  /** Primary metric value; defaults to `'...'` while loading. */
  value?: string | number
  /** Unit suffix rendered after the value. */
  unit?: string
  /** Semantic tone applied as accent colour and border. */
  tone?: KPITone
  /** Icon name from the Kerry icon set rendered alongside the label. */
  icon?: IconName
  /** Delta string (e.g. `'+3.2%'`) rendered below the value. */
  delta?: string
  /** Trend direction that colours the delta arrow. */
  trend?: 'up' | 'down'
  /** Sparkline data points for the mini trend line. */
  sparkline?: number[]
  /** Secondary line of text shown below the delta. */
  subtext?: string
  /** Progress bar fill as a percentage (0–100). */
  progressBar?: number
}

export function KpiCardWidget({ config, props, data }: WidgetRenderProps<KpiCardWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<KpiCardWidgetProps> : {}
  const merged = { ...props, ...source }

  return (
    <KPI
      label={merged.label ?? config.title ?? config.id}
      value={merged.value ?? '...'}
      unit={merged.unit}
      tone={merged.tone ?? 'neutral'}
      icon={merged.icon}
      delta={merged.delta}
      trend={merged.trend}
      sparkline={merged.sparkline}
      subtext={merged.subtext}
      progressBar={merged.progressBar}
    />
  )
}
