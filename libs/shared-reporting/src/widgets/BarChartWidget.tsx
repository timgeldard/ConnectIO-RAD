import type { EChartsOption } from 'echarts'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'
import { EChart } from '../charts/EChart'
import { REPORTING_CHART_GRID } from '../charts/echartsTheme'

/** A single data series rendered as a bar group. */
export interface BarSeries {
  /** Series name shown in the legend and tooltip. */
  name: string
  /** Values aligned to the `categories` array. */
  data: number[]
  /** Optional hex/CSS colour override for this series. */
  color?: string
}

/** Props for BarChartWidget; all optional and merged with runtime data. */
export interface BarChartWidgetProps extends Record<string, unknown> {
  /** Category axis labels. */
  categories?: string[]
  /** One or more data series to render. */
  series?: BarSeries[]
  /** When true, renders a horizontal bar chart. */
  horizontal?: boolean
  /** Label for the value axis. */
  valueLabel?: string
  /** Chart height in pixels; defaults to 280. */
  height?: number
}

/** Renders a vertical or horizontal bar chart via ECharts. */
export function BarChartWidget({ config, props, data }: WidgetRenderProps<BarChartWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<BarChartWidgetProps> : {}
  const merged = { ...props, ...source }

  const categories = merged.categories ?? []
  const series = merged.series ?? []
  const horizontal = merged.horizontal ?? false
  const title = config.title

  const categoryAxis = { type: 'category' as const, data: categories }
  const valueAxis = { type: 'value' as const, name: merged.valueLabel }

  const option: EChartsOption = {
    grid: REPORTING_CHART_GRID,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: series.length > 1 ? {} : undefined,
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map(s => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      ...(s.color ? { itemStyle: { color: s.color } } : {}),
    })),
  }

  return (
    <ChartContainer title={title} description={config.description} height={merged.height}>
      {categories.length > 0 && series.length > 0 ? (
        <EChart option={option} style={{ height: merged.height ?? 280, width: '100%' }} ariaLabel={title} notMerge />
      ) : (
        <div role="status" style={{ padding: 24, color: 'var(--text-3)' }}>No bar chart data available.</div>
      )}
    </ChartContainer>
  )
}
