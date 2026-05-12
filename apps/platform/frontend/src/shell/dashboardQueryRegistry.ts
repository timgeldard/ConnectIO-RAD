import type { QueryRegistry } from '@connectio/shared-reporting';

/**
 * Platform-wide query registry for dashboard data binding.
 * 
 * This registry defines the available manufacturing queries that widgets
 * can bind to. It keeps manufacturing-specific knowledge in the platform
 * app while shared-reporting remains generic.
 */
export const dashboardQueryRegistry: QueryRegistry = {
  'poh.oeeAnalytics': {
    key: 'poh.oeeAnalytics',
    label: 'POH: OEE Analytics',
    description: 'Overall Equipment Effectiveness by line and daily trend.',
    endpoint: '/api/poh/oee/analytics',
    method: 'POST',
    compatibleWidgets: ['kpi', 'trend', 'bar'],
    params: [
      { key: 'plant_id', label: 'Plant ID', type: 'string', required: true },
      { key: 'date_from', label: 'From Date', type: 'date', required: true },
      { key: 'date_to', label: 'To Date', type: 'date', required: true },
      { key: 'timezone', label: 'Timezone', type: 'string', defaultValue: 'UTC' },
    ],
    fields: [
      { path: 'lines.0.avg_oee_pct', label: 'Average OEE % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_availability_pct', label: 'Availability % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_performance_pct', label: 'Performance % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.avg_quality_pct', label: 'Quality % (Top Line)', type: 'number', semantic: 'percentage' },
      { path: 'lines.0.daily_history', label: 'Daily OEE History (Top Line)', type: 'array' },
      { path: 'lines', label: 'All Lines Stats', type: 'array' },
    ],
  },
  'spc.qualityControl': {
    key: 'spc.qualityControl',
    label: 'SPC: Quality Control',
    description: 'Statistical Process Control data for quality attributes.',
    endpoint: '/api/spc/quality/control',
    method: 'POST',
    compatibleWidgets: ['spc-control'],
    params: [
      { key: 'attribute_id', label: 'Attribute', type: 'string', required: true },
      { key: 'limit', label: 'Sample Count', type: 'number', defaultValue: 30 },
    ],
    fields: [
      { path: 'points', label: 'Data Points', type: 'array' },
      { path: 'summary.limits', label: 'Control Limits', type: 'object' },
    ],
  },
};
