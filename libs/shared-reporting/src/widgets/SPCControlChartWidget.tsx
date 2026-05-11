/* eslint-disable jsdoc/require-jsdoc */
import type { EChartsOption } from 'echarts'
import { ChartContainer } from '../components/ChartContainer'
import type { WidgetRenderProps } from '../core/types'
import { EChart } from '../charts/EChart'
import { REPORTING_CHART_GRID } from '../charts/echartsTheme'

/** A single plotted measurement on the control chart. */
export interface SPCDataPoint {
  /** X-axis label (e.g. sample ID or timestamp string). */
  label: string
  /** Measured value. */
  value: number
  /** When true the point is rendered in muted colour and excluded from limit calculations. */
  excluded?: boolean
  /** True if this point triggered a control rule violation. */
  signal?: boolean
}

/** Western Electric / Nelson control limits for the chart reference lines. */
export interface SPCControlLimits {
  /** Upper control limit. */
  ucl?: number
  /** Centre line (process mean). */
  cl?: number
  /** Lower control limit. */
  lcl?: number
  /** 1-sigma boundary above the centre line. */
  sigma1?: number
  /** 2-sigma boundary above the centre line. */
  sigma2?: number
}

/** Props for SPCControlChartWidget; all optional and merged with runtime data. */
export interface SPCControlChartWidgetProps extends Record<string, unknown> {
  /** Ordered list of measurement points. */
  points?: SPCDataPoint[]
  /** Control limits to render as reference lines and sigma bands. */
  limits?: SPCControlLimits
  /** Label for the value (y) axis. */
  valueLabel?: string
  /** Chart height in pixels; defaults to 320. */
  height?: number
}

function pointColor(point: SPCDataPoint): string {
  if (point.excluded) return '#9CA3AF'
  if (point.signal) return '#EF4444'
  return 'inherit'
}

export function SPCControlChartWidget({ config, props, data }: WidgetRenderProps<SPCControlChartWidgetProps>) {
  const source = typeof data === 'object' && data != null ? data as Partial<SPCControlChartWidgetProps> : {}
  const merged = { ...props, ...source }

  const points = merged.points ?? []
  const limits = merged.limits ?? {}
  const title = config.title

  const markLines: any[] = []
  if (limits.ucl != null) markLines.push({ yAxis: limits.ucl, name: 'UCL', lineStyle: { color: '#EF4444', type: 'dashed' as const } })
  if (limits.cl != null) markLines.push({ yAxis: limits.cl, name: 'CL', lineStyle: { color: '#6B7280', type: 'solid' as const } })
  if (limits.lcl != null) markLines.push({ yAxis: limits.lcl, name: 'LCL', lineStyle: { color: '#EF4444', type: 'dashed' as const } })

  const markAreas: Array<[{ yAxis: number }, { yAxis: number }]> = []
  if (limits.cl != null && limits.sigma1 != null) {
    const deviation = limits.sigma1 - limits.cl
    markAreas.push([{ yAxis: limits.cl - deviation }, { yAxis: limits.cl + deviation }])
  }
  if (limits.cl != null && limits.sigma2 != null && limits.sigma1 != null) {
    const dev2 = limits.sigma2 - limits.cl
    const dev1 = limits.sigma1 - limits.cl
    markAreas.push(
      [{ yAxis: limits.cl + dev1 }, { yAxis: limits.cl + dev2 }],
      [{ yAxis: limits.cl - dev2 }, { yAxis: limits.cl - dev1 }],
    )
  }

  const option: EChartsOption = {
    grid: REPORTING_CHART_GRID,
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: points.map(p => p.label) },
    yAxis: { type: 'value', name: merged.valueLabel },
    series: [
      {
        type: 'line',
        data: points.map(p => ({
          value: p.value,
          itemStyle: { color: pointColor(p) },
          symbol: p.signal ? 'diamond' : 'circle',
          symbolSize: p.signal ? 10 : 6,
        })),
        markLine: markLines.length > 0 ? { silent: true, data: markLines } : undefined,
        markArea: markAreas.length > 0 ? {
          silent: true,
          itemStyle: { opacity: 0.06 },
          data: markAreas,
        } : undefined,
      },
    ],
  }

  return (
    <ChartContainer title={title} description={config.description} height={merged.height}>
      {points.length > 0 ? (
        <EChart option={option} style={{ height: merged.height ?? 320, width: '100%' }} ariaLabel={title} notMerge />
      ) : (
        <div role="status" style={{ padding: 24, color: 'var(--text-3)' }}>No control chart data available.</div>
      )}
    </ChartContainer>
  )
}
