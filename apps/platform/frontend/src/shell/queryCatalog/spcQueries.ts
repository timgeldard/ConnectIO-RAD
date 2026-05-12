import type { QueryRegistry } from '@connectio/shared-reporting';
import { endpoint, postQuery, widgetCompatibility } from './common';

/**
 * Statistical process control query definitions for the platform dashboard builder.
 */
export const spcQueries: QueryRegistry = {
  'spc.qualityControl': postQuery({
    key: 'spc.qualityControl',
    label: 'SPC: Quality Control',
    description: 'Statistical Process Control data for quality attributes.',
    endpoint: endpoint('spc', 'quality/control'),
    compatibleWidgets: widgetCompatibility.spcOnly,
    params: [
      { key: 'attribute_id', label: 'Attribute', type: 'string', required: true },
      { key: 'limit', label: 'Sample Count', type: 'number', defaultValue: 30 },
    ],
    fields: [
      { path: 'points', label: 'Data Points', type: 'array' },
      { path: 'summary.limits', label: 'Control Limits', type: 'object' },
    ],
  }),
};
