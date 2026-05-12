import type { QueryRegistry } from '@connectio/shared-reporting';
import { endpoint, params, postQuery, widgetCompatibility } from './common';

/**
 * Process Order History query definitions for the platform dashboard builder.
 */
export const pohQueries: QueryRegistry = {
  'poh.oeeAnalytics': postQuery({
    key: 'poh.oeeAnalytics',
    label: 'POH: OEE Analytics',
    description: 'Overall Equipment Effectiveness by line and daily trend.',
    endpoint: endpoint('poh', 'oee/analytics'),
    compatibleWidgets: widgetCompatibility.kpiTrendBar,
    params: params('plant_id', 'date_from', 'date_to', 'timezone'),
    fields: [
      { path: 'lines.0.avg_oee_pct', label: 'Average OEE % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_availability_pct', label: 'Availability % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_performance_pct', label: 'Performance % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_quality_pct', label: 'Quality % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.daily_history', label: 'Daily OEE History (Top Line)', type: 'array' },
      { path: 'lines', label: 'All Lines Stats', type: 'array' },
    ],
  }),
};
