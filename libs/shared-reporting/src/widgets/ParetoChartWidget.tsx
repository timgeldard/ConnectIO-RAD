/* eslint-disable jsdoc/require-jsdoc */
import type { EChartsOption } from 'echarts'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'
import { EChart } from '../charts/EChart'
import { REPORTING_CHART_GRID } from '../charts/echartsTheme'

/** A single category/value pair for Pareto analysis. */
export interface ParetoItem {
  /** Category label shown on the x-axis. */
  label: string
  /** Contribution value; items are sorted descending automatically. */
  value: number
}

/** Props for ParetoChartWidget; all optional and merged with runtime data. */
export interface ParetoChartWidgetProps extends Record<string, unknown> {
  /** Unsorted list of Pareto items; the widget sorts them. */
  items?: ParetoItem[]
  /** Label for the primary value axis. */
  valueLabel?: string
  /** Label for the secondary cumulative percentage axis. */
  cumulativeLabel?: string
  /** Chart height in pixels; defaults to 280. */
  height?: number
}

/** Renders a Pareto bar+line chart with a cumulative percentage overlay. */
export function ParetoChartWidget({ config, props, data }: WidgetRenderProps<ParetoChartWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<ParetoChartWidgetProps> : {}
  const merged = { ...props, ...source }

  const items = [...(merged.items ?? [])].sort((a, b) => b.value - a.value)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const title = config.title

  const cumulative: number[] = []
  let running = 0
  for (const item of items) {
    running += item.value
    cumulative.push(total > 0 ? Math.round((running / total) * 1000) / 10 : 0)
  }

  const option: EChartsOption = {
    grid: { ...REPORTING_CHART_GRID, right: 60 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: [merged.valueLabel ?? 'Count', merged.cumulativeLabel ?? 'Cumulative %'],
    },
    xAxis: { type: 'category', data: items.map(i => i.label) },
    yAxis: [
      { type: 'value', name: merged.valueLabel ?? 'Count' },
      { type: 'value', name: merged.cumulativeLabel ?? 'Cumulative %', max: 100, axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      {
        name: merged.valueLabel ?? 'Count',
        type: 'bar',
        data: items.map(i => i.value),
        yAxisIndex: 0,
      },
      {
        name: merged.cumulativeLabel ?? 'Cumulative %',
        type: 'line',
        smooth: false,
        data: cumulative,
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  return (
    <ChartContainer title={title} description={config.description} height={merged.height}>
      {items.length > 0 ? (
        <EChart option={option} style={{ height: merged.height ?? 280, width: '100%' }} ariaLabel={title} notMerge />
      ) : (
        <div role="status" style={{ padding: 24, color: 'var(--text-3)' }}>No Pareto data available.</div>
      )}
    </ChartContainer>
  )
}
