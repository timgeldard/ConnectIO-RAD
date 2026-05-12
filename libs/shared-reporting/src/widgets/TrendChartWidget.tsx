/* eslint-disable jsdoc/require-jsdoc */
import type { EChartsOption } from 'echarts'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'
import { EChart } from '../charts/EChart'
import { REPORTING_CHART_GRID } from '../charts/echartsTheme'

export interface TrendPoint {
  label: string
  value: number
}

export interface TrendChartWidgetProps extends Record<string, unknown> {
  title?: string
  description?: string
  points?: TrendPoint[]
  valueLabel?: string
  height?: number
}

export function TrendChartWidget({ config, props, data }: WidgetRenderProps<TrendChartWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<TrendChartWidgetProps> : {}
  const merged = { ...props, ...source }
  const points = merged.points ?? []
  const title = merged.title ?? config.title

  const option: EChartsOption = {
    grid: REPORTING_CHART_GRID,
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.label),
    },
    yAxis: {
      type: 'value',
      name: merged.valueLabel,
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: points.map((point) => point.value),
      },
    ],
  }

  return (
    <ChartContainer title={title} description={merged.description ?? config.description} height={merged.height}>
      {points.length > 0 ? (
        <EChart option={option} style={{ height: merged.height ?? 280, width: '100%' }} ariaLabel={title} notMerge />
      ) : (
        <div role="status" style={{ padding: 24, color: 'var(--text-3)' }}>No trend data available.</div>
      )}
    </ChartContainer>
  )
}
