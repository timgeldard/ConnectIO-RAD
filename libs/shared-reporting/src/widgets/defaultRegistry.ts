import { createWidgetRegistry } from '../core/registry'
import { KpiCardWidget } from './KpiCardWidget'
import { TrendChartWidget } from './TrendChartWidget'

export function createDefaultReportingRegistry() {
  return createWidgetRegistry({
    kpi: KpiCardWidget,
    trend: TrendChartWidget,
  })
}
