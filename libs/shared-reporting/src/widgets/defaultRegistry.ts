import { createWidgetRegistry } from '../core/registry'
import { KpiCardWidget } from './KpiCardWidget'
import { TrendChartWidget } from './TrendChartWidget'
import { BarChartWidget } from './BarChartWidget'
import { ParetoChartWidget } from './ParetoChartWidget'
import { SPCControlChartWidget } from './SPCControlChartWidget'
import { DrillDownTableWidget } from './DrillDownTableWidget'

export function createDefaultReportingRegistry() {
  return createWidgetRegistry({
    kpi: KpiCardWidget,
    trend: TrendChartWidget,
    bar: BarChartWidget,
    pareto: ParetoChartWidget,
    'spc-control': SPCControlChartWidget,
    'drill-down-table': DrillDownTableWidget,
  })
}
