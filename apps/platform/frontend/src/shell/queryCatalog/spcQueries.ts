import type { QueryField, QueryRegistry, QueryValueType } from '@connectio/shared-reporting';
import { apiEndpoint, getQuery, params, postQuery, widgetCompatibility } from './common';

/**
 * Creates an SPC-specific field definition.
 *
 * @param path - Dot-path in the response payload.
 * @param label - Human-readable field label.
 * @param type - Expected value type.
 * @param semantic - Optional semantic hint for mapping defaults.
 * @returns Query field metadata for the registry.
 */
function spcField(
  path: string,
  label: string,
  type: QueryValueType,
  semantic?: QueryField['semantic'],
): QueryField {
  return { path, label, type, semantic };
}

const spcParams = params('plant_id', 'date_from', 'date_to', 'timezone', 'material_id');
const micParam = { key: 'mic_id', label: 'MIC', type: 'string' as const };
const limitParam = { key: 'limit', label: 'Sample count', type: 'number' as const, defaultValue: 30 };

/**
 * Statistical process control query definitions for the platform dashboard builder.
 *
 * This `QueryRegistry` maps SPC-oriented bindings onto the current platform SPC
 * API surface so dashboard widgets execute against real process-control routes.
 */
export const spcQueries: QueryRegistry = {
  'spc.qualityControl': postQuery({
    key: 'spc.qualityControl',
    label: 'SPC Quality Control',
    description: 'Primary SPC control chart for a selected MIC with control limits and per-sample signals.',
    endpoint: apiEndpoint('spc','chart-data'),
    compatibleWidgets: widgetCompatibility.spcOnly,
    params: [...spcParams, micParam, limitParam],
    fields: [
      spcField('points', 'SPC points', 'array'),
      spcField('summary.limits', 'Control limits', 'object'),
      spcField('ucl', 'Upper control limit', 'number'),
      spcField('cl', 'Center line', 'number'),
      spcField('lcl', 'Lower control limit', 'number'),
      spcField('mic_id', 'MIC', 'string'),
      spcField('mic_description', 'MIC description', 'string'),
    ],
    sampleResponse: {
      points: [
        { label: 'Sample 1', value: 5.2, signal: false, excluded: false },
        { label: 'Sample 2', value: 5.4, signal: false, excluded: false },
        { label: 'Sample 3', value: 5.9, signal: true, excluded: false },
      ],
      summary: {
        limits: {
          ucl: 6.1,
          cl: 5.0,
          lcl: 3.9,
        },
      },
      ucl: 6.1,
      cl: 5.0,
      lcl: 3.9,
      mic_id: 'MIC-001',
      mic_description: 'Moisture',
    },
  }),
  'spc.attributeControlHistory': postQuery({
    key: 'spc.attributeControlHistory',
    label: 'Attribute Control History',
    description: 'Historical SPC view of a MIC with trend-ready points and tabular sample details.',
    endpoint: apiEndpoint('spc','chart-data'),
    compatibleWidgets: widgetCompatibility.spcTrendTable,
    params: [...spcParams, micParam, limitParam],
    fields: [
      spcField('points', 'SPC points', 'array'),
      spcField('rows', 'Rows', 'array'),
      spcField('sample_date', 'Sample date', 'date'),
      spcField('result_value', 'Result value', 'number'),
      spcField('signal', 'Signal flag', 'boolean'),
      spcField('summary.limits', 'Control limits', 'object'),
      spcField('mic_id', 'MIC', 'string'),
      spcField('mic_description', 'MIC description', 'string'),
    ],
    sampleResponse: {
      points: [
        { label: '2026-05-08', value: 4.9, signal: false, excluded: false },
        { label: '2026-05-09', value: 5.2, signal: false, excluded: false },
        { label: '2026-05-10', value: 5.9, signal: true, excluded: false },
      ],
      rows: [
        { sample_date: '2026-05-08', result_value: 4.9, signal: false },
        { sample_date: '2026-05-09', result_value: 5.2, signal: false },
        { sample_date: '2026-05-10', result_value: 5.9, signal: true },
      ],
      summary: {
        limits: {
          ucl: 6.1,
          cl: 5.0,
          lcl: 3.9,
        },
      },
      mic_id: 'MIC-001',
      mic_description: 'Moisture',
    },
  }),
  'spc.lockedLimits': getQuery({
    key: 'spc.lockedLimits',
    label: 'Locked Limits',
    description: 'Displays fixed SPC limit sets for governed attributes and the samples assessed against them.',
    endpoint: apiEndpoint('spc','locked-limits'),
    compatibleWidgets: widgetCompatibility.spcTable,
    params: [...spcParams, micParam],
    fields: [
      spcField('points', 'SPC points', 'array'),
      spcField('limits', 'Limits', 'object'),
      spcField('summary.limits', 'Summary limits', 'object'),
      spcField('rows', 'Rows', 'array'),
      spcField('ucl', 'Upper control limit', 'number'),
      spcField('cl', 'Center line', 'number'),
      spcField('lcl', 'Lower control limit', 'number'),
    ],
    sampleResponse: {
      points: [
        { label: 'Sample 1', value: 4.8, signal: false, excluded: false },
        { label: 'Sample 2', value: 5.1, signal: false, excluded: false },
      ],
      limits: {
        ucl: 5.8,
        cl: 5.0,
        lcl: 4.2,
      },
      summary: {
        limits: {
          ucl: 5.8,
          cl: 5.0,
          lcl: 4.2,
        },
      },
      rows: [
        { mic_id: 'MIC-001', ucl: 5.8, cl: 5.0, lcl: 4.2, locked_reason: 'Validated control model' },
      ],
      ucl: 5.8,
      cl: 5.0,
      lcl: 4.2,
    },
  }),
  'spc.signalSummary': postQuery({
    key: 'spc.signalSummary',
    label: 'Signal Summary',
    description: 'Summarises SPC rule violations by signal type so teams can prioritise the dominant control issues.',
    endpoint: apiEndpoint('spc','data-quality'),
    compatibleWidgets: widgetCompatibility.kpiBarParetoTable,
    params: [...spcParams, micParam],
    fields: [
      spcField('value', 'Signal count', 'number', 'count'),
      spcField('failure_count', 'Failure count', 'number', 'count'),
      spcField('failure_rate_pct', 'Signal rate %', 'number', 'percentage'),
      spcField('items', 'Pareto items', 'array'),
      spcField('rows', 'Rows', 'array'),
      spcField('categories', 'Categories', 'array'),
      spcField('series', 'Series', 'array'),
    ],
    sampleResponse: {
      value: 7,
      failure_count: 7,
      failure_rate_pct: 5.8,
      categories: ['Point beyond limit', 'Trend run', 'Zone A'],
      series: [{ name: 'Signals', data: [3, 2, 2] }],
      items: [
        { label: 'Point beyond limit', value: 3 },
        { label: 'Trend run', value: 2 },
        { label: 'Zone A', value: 2 },
      ],
      rows: [
        { signal_type: 'Point beyond limit', failure_count: 3, failure_rate_pct: 2.5 },
        { signal_type: 'Trend run', failure_count: 2, failure_rate_pct: 1.7 },
      ],
    },
  }),
};
