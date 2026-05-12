import type { QueryField, QueryRegistry, QueryValueType } from '@connectio/shared-reporting';
import { endpoint, fields as selectFields, getQuery, params, widgetCompatibility } from './common';

/**
 * Creates a procurement field definition.
 *
 * @param path - Dot-path in the response payload.
 * @param label - Human-readable field label.
 * @param type - Expected value type.
 * @param semantic - Optional semantic hint for mapping defaults.
 * @returns Query field metadata for the registry.
 */
function procurementField(
  path: string,
  label: string,
  type: QueryValueType,
  semantic?: QueryField['semantic'],
): QueryField {
  return { path, label, type, semantic };
}

const procurementParams = params('plant_id', 'date_from', 'date_to', 'material_id', 'batch_id', 'supplier_id');

/**
 * Procurement query definitions for the platform dashboard builder.
 */
export const procurementQueries: QueryRegistry = {
  'procurement.openPurchaseOrders': getQuery({
    key: 'procurement.openPurchaseOrders',
    label: 'Open Purchase Orders',
    description: 'Open purchase order quantities by supplier and material.',
    endpoint: endpoint('wh', 'inbound'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: procurementParams,
    fields: [
      procurementField('value', 'Open purchase quantity', 'number'),
      procurementField('rows', 'Rows', 'array'),
      procurementField('points', 'Points', 'array', 'timeseries'),
      procurementField('categories', 'Categories', 'array'),
      procurementField('series', 'Series', 'array'),
      ...selectFields('supplier_id', 'material_id', 'material_description', 'quantity', 'uom', 'status'),
      procurementField('supplier_name', 'Supplier name', 'string'),
      procurementField('purchase_order_id', 'Purchase order', 'string'),
    ],
    sampleResponse: {
      value: 8420,
      points: [
        { label: 'Mon', value: 8120 },
        { label: 'Tue', value: 8260 },
        { label: 'Wed', value: 8420 },
      ],
      categories: ['Protein supplier A', 'Seasoning supplier B'],
      series: [{ name: 'Open qty', data: [5220, 3200] }],
      rows: [
        { supplier_id: '2000123', supplier_name: 'Protein supplier A', purchase_order_id: '4500123456', material_id: '000000000010000021', material_description: 'Chicken fillet trim', quantity: 3120, uom: 'KG', status: 'Open' },
      ],
    },
  }),
  'procurement.inboundSchedule': getQuery({
    key: 'procurement.inboundSchedule',
    label: 'Inbound Schedule',
    description: 'Scheduled inbound purchase and STO arrivals over time.',
    endpoint: endpoint('wh', 'inbound'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: procurementParams,
    fields: [
      procurementField('value', 'Scheduled inbound quantity', 'number'),
      procurementField('rows', 'Rows', 'array'),
      procurementField('points', 'Points', 'array', 'timeseries'),
      procurementField('categories', 'Categories', 'array'),
      procurementField('series', 'Series', 'array'),
      procurementField('purchase_order_id', 'Purchase order', 'string'),
      procurementField('sto_id', 'STO', 'string'),
      ...selectFields('supplier_id', 'material_id', 'material_description', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 6240,
      points: [
        { label: 'Thu', value: 1820 },
        { label: 'Fri', value: 2150 },
        { label: 'Sat', value: 2270 },
      ],
      categories: ['PO', 'STO'],
      series: [{ name: 'Inbound qty', data: [4380, 1860] }],
      rows: [
        { purchase_order_id: '4500123456', supplier_id: '2000123', material_id: '000000000010000021', material_description: 'Chicken fillet trim', quantity: 1820, uom: 'KG', status: 'ETA Thu 09:00' },
      ],
    },
  }),
  'procurement.vendorPerformance': getQuery({
    key: 'procurement.vendorPerformance',
    label: 'Vendor Performance',
    description: 'Supplier performance by delivery adherence and inbound quality.',
    endpoint: endpoint('wh', 'inbound'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: procurementParams,
    fields: [
      procurementField('value', 'On-time inbound %', 'number', 'percentage'),
      procurementField('rows', 'Rows', 'array'),
      procurementField('categories', 'Categories', 'array'),
      procurementField('series', 'Series', 'array'),
      ...selectFields('supplier_id', 'quantity', 'status'),
      procurementField('supplier_name', 'Supplier name', 'string'),
    ],
    sampleResponse: {
      value: 94.2,
      categories: ['Protein supplier A', 'Seasoning supplier B'],
      series: [{ name: 'On-time %', data: [96.1, 91.8] }],
      rows: [
        { supplier_id: '2000123', supplier_name: 'Protein supplier A', quantity: 3120, status: 'On time', on_time_pct: 96.1 },
      ],
    },
  }),
  'procurement.importArrivalRisk': getQuery({
    key: 'procurement.importArrivalRisk',
    label: 'Import Arrival Risk',
    description: 'Risk-ranked import arrivals based on ETA slippage and exposure quantity.',
    endpoint: endpoint('wh', 'inbound'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: procurementParams,
    fields: [
      procurementField('value', 'At-risk inbound quantity', 'number'),
      procurementField('rows', 'Rows', 'array'),
      procurementField('categories', 'Categories', 'array'),
      procurementField('series', 'Series', 'array'),
      ...selectFields('supplier_id', 'material_id', 'material_description', 'quantity', 'uom', 'status'),
      procurementField('supplier_name', 'Supplier name', 'string'),
    ],
    sampleResponse: {
      value: 2140,
      categories: ['Port delay', 'Carrier delay', 'Customs hold'],
      series: [{ name: 'At-risk qty', data: [980, 760, 400] }],
      rows: [
        { supplier_id: '2000123', supplier_name: 'Protein supplier A', material_id: '000000000010000021', material_description: 'Chicken fillet trim', quantity: 980, uom: 'KG', status: 'Port delay' },
      ],
    },
  }),
  'procurement.stoInbound': getQuery({
    key: 'procurement.stoInbound',
    label: 'STO Inbound',
    description: 'Inbound stock transport order receipts by source and destination.',
    endpoint: endpoint('wh', 'inbound'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: procurementParams,
    fields: [
      procurementField('value', 'STO inbound quantity', 'number'),
      procurementField('rows', 'Rows', 'array'),
      procurementField('points', 'Points', 'array', 'timeseries'),
      procurementField('categories', 'Categories', 'array'),
      procurementField('series', 'Series', 'array'),
      procurementField('sto_id', 'STO', 'string'),
      ...selectFields('material_id', 'material_description', 'quantity', 'uom', 'status'),
    ],
    sampleResponse: {
      value: 1860,
      points: [
        { label: 'Thu', value: 620 },
        { label: 'Fri', value: 540 },
        { label: 'Sat', value: 700 },
      ],
      categories: ['From C351', 'From C102'],
      series: [{ name: 'Inbound qty', data: [980, 880] }],
      rows: [
        { sto_id: '4600012451', material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', quantity: 620, uom: 'KG', status: 'In transit' },
      ],
    },
  }),
};
