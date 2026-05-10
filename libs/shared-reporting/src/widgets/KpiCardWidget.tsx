import { KPI, type KPITone } from '@connectio/shared-ui'
import type { WidgetRenderProps } from '../core/types'

export interface KpiCardWidgetProps extends Record<string, unknown> {
  label?: string
  value?: string | number
  unit?: string
  tone?: KPITone
  delta?: string
  trend?: 'up' | 'down'
  sparkline?: number[]
  subtext?: string
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
      delta={merged.delta}
      trend={merged.trend}
      sparkline={merged.sparkline}
      subtext={merged.subtext}
    />
  )
}
