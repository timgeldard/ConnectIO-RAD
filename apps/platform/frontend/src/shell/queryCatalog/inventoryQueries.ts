import type { QueryField, QueryRegistry, QueryValueType } from '@connectio/shared-reporting';
import { endpoint, fields as selectFields, getQuery, params, widgetCompatibility } from './common';

/**
 * Creates an inventory field definition.
 *
 * @param path - Dot-path in the response payload.
 * @param label - Human-readable field label.
 * @param type - Expected value type.
 * @param semantic - Optional semantic hint for mapping defaults.
 * @returns Query field metadata for the registry.
 */
function inventoryField(
  path: string,
  label: string,
  type: QueryValueType,
  semantic?: QueryField['semantic'],
): QueryField {
  return { path, label, type, semantic };
}

const inventoryParams = params('plant_id', 'date_from', 'date_to', 'material_id', 'batch_id');

/**
 * Inventory query definitions for the platform dashboard builder.
 *
 * This `QueryRegistry` exposes inventory-oriented bindings while reusing the
 * existing Warehouse360 routes mounted into the platform shell.
 */
export const inventoryQueries: QueryRegistry = {
  'inventory.stockByMaterial': getQuery({
    key: 'inventory.stockByMaterial',
    label: 'Stock by Material',
    description: 'Aggregated stock by material for KPI, bar, and drill-down table views.',
    endpoint: endpoint('wh', 'imwm/stock'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Stock quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('material_id', 'material_description', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 15420,
      categories: ['Breaded strips 5kg', 'Chicken bites 4kg', 'Nuggets 10kg'],
      series: [{ name: 'Stock qty', data: [6420, 4880, 4120] }],
      rows: [
        { material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', quantity: 6420, uom: 'KG', status: 'Released' },
      ],
    },
  }),
  'inventory.stockByBatch': getQuery({
    key: 'inventory.stockByBatch',
    label: 'Stock by Batch',
    description: 'Stock by batch with quantity, status, and ageing context.',
    endpoint: endpoint('wh', 'inventory/bins'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Stock quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 6420,
      categories: ['0008602411', '0008602422', '0008602433'],
      series: [{ name: 'Stock qty', data: [2480, 1900, 2040] }],
      rows: [
        { material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602411', quantity: 2480, uom: 'KG', status: 'Released' },
      ],
    },
  }),
  'inventory.stockByStatus': getQuery({
    key: 'inventory.stockByStatus',
    label: 'Stock by Status',
    description: 'Inventory split by unrestricted, quality, blocked, and other status buckets.',
    endpoint: endpoint('wh', 'imwm/stock'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Total stock quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('status', 'quantity', 'uom'),
    ],
    sampleResponse: {
      value: 15420,
      categories: ['Unrestricted', 'Quality', 'Blocked'],
      series: [{ name: 'Stock qty', data: [13240, 1580, 600] }],
      rows: [
        { status: 'Unrestricted', quantity: 13240, uom: 'KG' },
        { status: 'Quality', quantity: 1580, uom: 'KG' },
      ],
    },
  }),
  'inventory.expiryRisk': getQuery({
    key: 'inventory.expiryRisk',
    label: 'Expiry Risk',
    description: 'Batches nearing expiry, ranked by quantity and urgency.',
    endpoint: endpoint('wh', 'inventory/near-expiry'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'At-risk quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 980,
      categories: ['0-7 days', '8-14 days', '15-30 days'],
      series: [{ name: 'At-risk qty', data: [420, 310, 250] }],
      rows: [
        { material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602411', quantity: 420, uom: 'KG', status: 'Expires in 5 days' },
      ],
    },
  }),
  'inventory.blockedStock': getQuery({
    key: 'inventory.blockedStock',
    label: 'Blocked Stock',
    description: 'Blocked inventory by material and batch with quantity details.',
    endpoint: endpoint('wh', 'imwm/exceptions'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Blocked quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 600,
      categories: ['Breaded strips 5kg', 'Chicken bites 4kg'],
      series: [{ name: 'Blocked qty', data: [420, 180] }],
      rows: [
        { material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602411', quantity: 420, uom: 'KG', status: 'Blocked' },
      ],
    },
  }),
  'inventory.qualityStock': getQuery({
    key: 'inventory.qualityStock',
    label: 'Quality Stock',
    description: 'Stock in inspection hold by material and batch.',
    endpoint: endpoint('wh', 'imwm/stock'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Quality stock quantity', 'number'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 1580,
      categories: ['Breaded strips 5kg', 'Chicken bites 4kg'],
      series: [{ name: 'QI qty', data: [820, 760] }],
      rows: [
        { material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602450', quantity: 820, uom: 'KG', status: 'QI Hold' },
      ],
    },
  }),
  'inventory.movementTrend': getQuery({
    key: 'inventory.movementTrend',
    label: 'Movement Trend',
    description: 'Inventory movement trend across receipts, issues, and adjustments.',
    endpoint: endpoint('wh', 'imwm/movements'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: inventoryParams,
    fields: [
      inventoryField('value', 'Net movement quantity', 'number'),
      inventoryField('points', 'Points', 'array', 'timeseries'),
      inventoryField('rows', 'Rows', 'array'),
      inventoryField('categories', 'Categories', 'array'),
      inventoryField('series', 'Series', 'array'),
      ...selectFields('posting_date', 'quantity', 'uom'),
      inventoryField('movement_type', 'Movement type', 'string'),
    ],
    sampleResponse: {
      value: 430,
      points: [
        { label: 'Mon', value: 180 },
        { label: 'Tue', value: 110 },
        { label: 'Wed', value: 140 },
      ],
      categories: ['Receipts', 'Issues', 'Adjustments'],
      series: [{ name: 'Movement qty', data: [1240, 720, 90] }],
      rows: [
        { posting_date: '2026-05-12', movement_type: '101', quantity: 420, uom: 'KG' },
      ],
    },
  }),
};
