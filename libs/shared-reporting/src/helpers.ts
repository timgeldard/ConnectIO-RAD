import type { WidgetConfig } from './core/types'

// ---------------------------------------------------------------------------
// Widget config factories
// ---------------------------------------------------------------------------

/**
 * Builds a minimal WidgetConfig for a standalone KpiCardWidget.
 * Pass a `layout` to set colSpan when hosting inside a ReportingDashboard.
 */
export function makeKpiConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'kpi', title, props: {}, interactions: [], layout }
}

/** Builds a minimal WidgetConfig for a TrendChartWidget. */
export function makeTrendConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'trend', title, props: {}, interactions: [], layout }
}

/** Builds a minimal WidgetConfig for a BarChartWidget. */
export function makeBarConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'bar', title, props: {}, interactions: [], layout }
}

/** Builds a minimal WidgetConfig for a ParetoChartWidget. */
export function makeParetoConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'pareto', title, props: {}, interactions: [], layout }
}

/** Builds a minimal WidgetConfig for an SPCControlChartWidget. */
export function makeSpcConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'spc-control', title, props: {}, interactions: [], layout }
}

/** Builds a minimal WidgetConfig for a DrillDownTableWidget. */
export function makeTableConfig(
  id: string,
  title: string,
  layout: WidgetConfig['layout'] = {},
): WidgetConfig {
  return { id, type: 'drill-down-table', title, props: {}, interactions: [], layout }
}

// ---------------------------------------------------------------------------
// KPI data helpers
// ---------------------------------------------------------------------------

/**
 * Computes a ±N.N% delta string and trend direction for use with KpiCardWidget.
 * Returns an empty object when either value is null or prior is zero.
 */
export function deltaPct(
  current: number | null,
  prior: number | null,
): { delta?: string; trend?: 'up' | 'down' } {
  if (current == null || prior == null || prior === 0) return {}
  const pct = ((current - prior) / prior) * 100
  return { delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, trend: current >= prior ? 'up' : 'down' }
}

/**
 * Maps application-level quality strings to KpiCardWidget tone values.
 * Intended for domains that use 'good' / 'ok' / 'bad' semantics where 'ok'
 * means "borderline acceptable" (maps to 'warn'), not "all clear".
 */
export function mapTone(tone: string): 'ok' | 'warn' | 'risk' | 'neutral' {
  if (tone === 'good') return 'ok'
  if (tone === 'ok') return 'warn'
  if (tone === 'bad') return 'risk'
  return 'neutral'
}
