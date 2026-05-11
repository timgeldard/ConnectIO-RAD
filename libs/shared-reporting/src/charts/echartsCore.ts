/* eslint-disable jsdoc/require-jsdoc */
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { buildReportingEChartsTheme } from './echartsTheme'

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

let registered = false

/**
 * Registers the Connectio reporting ECharts theme once.
 * Call explicitly from each app's chart initialisation module rather than
 * relying on module-level side effects.
 */
export function ensureReportingEChartsTheme(themeName = 'connectio-reporting'): void {
  if (!registered) {
    echarts.registerTheme(themeName, buildReportingEChartsTheme())
    registered = true
  }
}

export { echarts }
