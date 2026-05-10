import type { EChartsOption } from 'echarts'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'
import { EChart } from '../charts/EChart'
import { REPORTING_CHART_GRID } from '../charts/echartsTheme'

export interface BarSeries {
  name: string
  data: number[]
  color?: string
}

export interface BarChartWidgetProps extends Record<string, unknown> {
  categories?: string[]
  series?: BarSeries[]
  horizontal?: boolean
  valueLabel?: string
  height?: number
}

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
