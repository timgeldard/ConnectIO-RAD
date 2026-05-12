import type { QueryField, QueryRegistry, QueryValueType } from '@connectio/shared-reporting';
import { endpoint, fields as selectFields, params, postQuery, widgetCompatibility } from './common';

/**
 * Creates a sales field definition.
 *
 * @param path - Dot-path in the response payload.
 * @param label - Human-readable field label.
 * @param type - Expected value type.
 * @param semantic - Optional semantic hint for mapping defaults.
 * @returns Query field metadata for the registry.
 */
function salesField(
  path: string,
  label: string,
  type: QueryValueType,
  semantic?: QueryField['semantic'],
): QueryField {
  return { path, label, type, semantic };
}

const salesParams = params('plant_id', 'date_from', 'date_to', 'material_id', 'batch_id', 'customer_id');

/**
 * Sales query definitions for the platform dashboard builder.
 */
export const salesQueries: QueryRegistry = {
  'sales.outboundDeliveries': postQuery({
    key: 'sales.outboundDeliveries',
    label: 'Sales Outbound Deliveries',
    description: 'Outbound delivery performance and quantity by customer and date.',
    endpoint: endpoint('sales', 'outbound-deliveries'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: salesParams,
    fields: [
      salesField('value', 'Delivered quantity', 'number'),
      salesField('rows', 'Rows', 'array'),
      salesField('points', 'Points', 'array', 'timeseries'),
      salesField('categories', 'Categories', 'array'),
      salesField('series', 'Series', 'array'),
      ...selectFields('customer_id', 'material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
      salesField('customer_name', 'Customer name', 'string'),
      salesField('delivery_id', 'Delivery', 'string'),
    ],
    sampleResponse: {
      value: 5120,
      points: [
        { label: 'Mon', value: 1520 },
        { label: 'Tue', value: 1680 },
        { label: 'Wed', value: 1920 },
      ],
      categories: ['Kerry Foods UK', 'Major Grocer EU'],
      series: [{ name: 'Delivered qty', data: [3120, 2000] }],
      rows: [
        { customer_id: '1000432', customer_name: 'Kerry Foods UK', delivery_id: '0080012455', material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602411', quantity: 1520, uom: 'KG', status: 'Delivered' },
      ],
    },
  }),
  'sales.customerExposure': postQuery({
    key: 'sales.customerExposure',
    label: 'Sales Customer Exposure',
    description: 'Ranks customer exposure by delivered quantity and number of affected deliveries.',
    endpoint: endpoint('sales', 'customer-exposure'),
    compatibleWidgets: widgetCompatibility.kpiBarParetoTable,
    params: salesParams,
    fields: [
      salesField('value', 'Customer count', 'number', 'count'),
      salesField('rows', 'Rows', 'array'),
      salesField('items', 'Pareto items', 'array'),
      salesField('categories', 'Categories', 'array'),
      salesField('series', 'Series', 'array'),
      ...selectFields('customer_id', 'material_id', 'batch_id', 'quantity', 'uom'),
      salesField('customer_name', 'Customer name', 'string'),
      salesField('delivery_id', 'Delivery', 'string'),
    ],
    sampleResponse: {
      value: 3,
      categories: ['Kerry Foods UK', 'Major Grocer EU', 'Foodservice Nordics'],
      series: [{ name: 'Delivered qty', data: [1520, 1180, 980] }],
      items: [
        { label: 'Kerry Foods UK', value: 1520 },
        { label: 'Major Grocer EU', value: 1180 },
      ],
      rows: [
        { customer_id: '1000432', customer_name: 'Kerry Foods UK', delivery_id: '0080012455', material_id: '000000000020052009', batch_id: '0008602411', quantity: 1520, uom: 'KG' },
      ],
    },
  }),
  'sales.deliveryPerformance': postQuery({
    key: 'sales.deliveryPerformance',
    label: 'Delivery Performance',
    description: 'Delivery adherence and shipment completion by customer and route.',
    endpoint: endpoint('sales', 'delivery-performance'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: salesParams,
    fields: [
      salesField('value', 'On-time delivery %', 'number', 'percentage'),
      salesField('rows', 'Rows', 'array'),
      salesField('points', 'Points', 'array', 'timeseries'),
      salesField('categories', 'Categories', 'array'),
      salesField('series', 'Series', 'array'),
      ...selectFields('customer_id', 'quantity', 'status'),
      salesField('customer_name', 'Customer name', 'string'),
    ],
    sampleResponse: {
      value: 96.4,
      points: [
        { label: 'Mon', value: 95.1 },
        { label: 'Tue', value: 96.8 },
        { label: 'Wed', value: 96.4 },
      ],
      categories: ['Kerry Foods UK', 'Major Grocer EU'],
      series: [{ name: 'On-time %', data: [97.2, 95.6] }],
      rows: [
        { customer_id: '1000432', customer_name: 'Kerry Foods UK', quantity: 1520, status: 'On time', on_time_pct: 97.2 },
      ],
    },
  }),
  'sales.openShipments': postQuery({
    key: 'sales.openShipments',
    label: 'Open Shipments',
    description: 'Open outbound shipments waiting for completion or departure.',
    endpoint: endpoint('sales', 'open-shipments'),
    compatibleWidgets: widgetCompatibility.kpiTrendBarTable,
    params: salesParams,
    fields: [
      salesField('value', 'Open shipment quantity', 'number'),
      salesField('rows', 'Rows', 'array'),
      salesField('points', 'Points', 'array', 'timeseries'),
      salesField('categories', 'Categories', 'array'),
      salesField('series', 'Series', 'array'),
      ...selectFields('customer_id', 'material_id', 'material_description', 'batch_id', 'quantity', 'uom', 'status'),
      salesField('customer_name', 'Customer name', 'string'),
      salesField('delivery_id', 'Delivery', 'string'),
    ],
    sampleResponse: {
      value: 860,
      points: [
        { label: '06:00', value: 420 },
        { label: '08:00', value: 680 },
        { label: '10:00', value: 860 },
      ],
      categories: ['Picking', 'Loading', 'Staged'],
      series: [{ name: 'Open shipment qty', data: [240, 320, 300] }],
      rows: [
        { customer_id: '1000432', customer_name: 'Kerry Foods UK', delivery_id: '0080012488', material_id: '000000000020052009', material_description: 'Breaded fillet strips 5kg', batch_id: '0008602411', quantity: 240, uom: 'KG', status: 'Picking' },
      ],
    },
  }),
  'sales.batchDeliveredToCustomers': postQuery({
    key: 'sales.batchDeliveredToCustomers',
    label: 'Batch Delivered to Customers',
    description: 'Customer-level delivery footprint for a specific batch.',
    endpoint: endpoint('sales', 'batch-delivered-to-customers'),
    compatibleWidgets: widgetCompatibility.kpiBarParetoTable,
    params: salesParams,
    fields: [
      salesField('value', 'Customer count', 'number', 'count'),
      salesField('rows', 'Rows', 'array'),
      salesField('items', 'Pareto items', 'array'),
      salesField('categories', 'Categories', 'array'),
      salesField('series', 'Series', 'array'),
      ...selectFields('customer_id', 'batch_id', 'quantity', 'uom'),
      salesField('customer_name', 'Customer name', 'string'),
      salesField('delivery_id', 'Delivery', 'string'),
    ],
    sampleResponse: {
      value: 3,
      categories: ['Kerry Foods UK', 'Major Grocer EU', 'Foodservice Nordics'],
      series: [{ name: 'Delivered qty', data: [1520, 1180, 980] }],
      items: [
        { label: 'Kerry Foods UK', value: 1520 },
        { label: 'Major Grocer EU', value: 1180 },
      ],
      rows: [
        { customer_id: '1000432', customer_name: 'Kerry Foods UK', delivery_id: '0080012455', batch_id: '0008602411', quantity: 1520, uom: 'KG' },
      ],
    },
  }),
};
