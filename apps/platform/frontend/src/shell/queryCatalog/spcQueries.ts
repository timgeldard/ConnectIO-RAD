import type { QueryRegistry } from '@connectio/shared-reporting';

/**
 * Statistical process control query definitions for the platform dashboard builder.
 */
export const spcQueries: QueryRegistry = {
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
