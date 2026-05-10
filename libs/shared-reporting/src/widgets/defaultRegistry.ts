import { createWidgetRegistry } from '../core/registry'
import { KpiCardWidget } from './KpiCardWidget'
import { TrendChartWidget } from './TrendChartWidget'
import { BarChartWidget } from './BarChartWidget'
import { ParetoChartWidget } from './ParetoChartWidget'
import { SPCControlChartWidget } from './SPCControlChartWidget'
import { DrillDownTableWidget } from './DrillDownTableWidget'

/** Creates a widget registry pre-loaded with all six built-in shared-reporting widgets. */
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
