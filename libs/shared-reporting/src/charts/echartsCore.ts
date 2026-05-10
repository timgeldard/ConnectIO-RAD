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
import { REPORTING_ECHARTS_THEME } from './echartsTheme'

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

export function ensureReportingEChartsTheme(themeName = 'connectio-reporting'): void {
  if (!registered) {
    echarts.registerTheme(themeName, REPORTING_ECHARTS_THEME)
    registered = true
  }
}

ensureReportingEChartsTheme()

export { echarts }
