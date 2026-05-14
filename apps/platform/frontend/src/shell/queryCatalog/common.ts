import type { QueryField, QueryParam, QueryRegistryEntry } from '@connectio/shared-reporting';

/**
 * Supported widget types in the dashboard query catalog.
 */
export type SupportedWidgetType =
  | 'kpi'
  | 'trend'
  | 'bar'
  | 'pareto'
  | 'spc-control'
  | 'drill-down-table';

/**
 * Canonical widget compatibility lists reused across the platform query catalog.
 */
export const widgetCompatibility = {
  kpiTrendBar: ['kpi', 'trend', 'bar'],
  kpiBarTable: ['kpi', 'bar', 'drill-down-table'],
  kpiTrendBarTable: ['kpi', 'trend', 'bar', 'drill-down-table'],
  kpiBarParetoTable: ['kpi', 'bar', 'pareto', 'drill-down-table'],
  trendTable: ['trend', 'drill-down-table'],
  trendBarTable: ['trend', 'bar', 'drill-down-table'],
  barParetoTable: ['bar', 'pareto', 'drill-down-table'],
  barTable: ['bar', 'drill-down-table'],
  spcOnly: ['spc-control'],
  spcTrendTable: ['spc-control', 'trend', 'drill-down-table'],
  spcTable: ['spc-control', 'drill-down-table'],
} satisfies Record<string, SupportedWidgetType[]>;

/**
 * Reusable query parameters shared across manufacturing domains.
 */
export const commonParams = {
  plant_id: { key: 'plant_id', label: 'Plant', type: 'string', required: true },
  date_from: { key: 'date_from', label: 'From date', type: 'date', required: true },
  date_to: { key: 'date_to', label: 'To date', type: 'date', required: true },
  timezone: { key: 'timezone', label: 'Timezone', type: 'string', defaultValue: 'UTC' },
  material_id: { key: 'material_id', label: 'Material', type: 'string' },
  batch_id: { key: 'batch_id', label: 'Batch', type: 'string' },
  resource_id: { key: 'resource_id', label: 'Resource', type: 'string' },
  line_id: { key: 'line_id', label: 'Line', type: 'string' },
  process_order_id: { key: 'process_order_id', label: 'Process order', type: 'string' },
  inspection_lot_id: { key: 'inspection_lot_id', label: 'Inspection lot', type: 'string' },
  supplier_id: { key: 'supplier_id', label: 'Supplier', type: 'string' },
  customer_id: { key: 'customer_id', label: 'Customer', type: 'string' },
  warehouse_number: { key: 'warehouse_number', label: 'Warehouse', type: 'string' },
  storage_type: { key: 'storage_type', label: 'Storage type', type: 'string' },
  storage_bin: { key: 'storage_bin', label: 'Storage bin', type: 'string' },
} satisfies Record<string, QueryParam>;

/**
 * Reusable fields shared across manufacturing domains.
 */
export const commonFields = {
  plant_id: { path: 'plant_id', label: 'Plant', type: 'string' },
  material_id: { path: 'material_id', label: 'Material', type: 'string' },
  material_description: { path: 'material_description', label: 'Material description', type: 'string' },
  batch_id: { path: 'batch_id', label: 'Batch', type: 'string' },
  posting_date: { path: 'posting_date', label: 'Posting date', type: 'date' },
  process_order_id: { path: 'process_order_id', label: 'Process order', type: 'string' },
  inspection_lot_id: { path: 'inspection_lot_id', label: 'Inspection lot', type: 'string' },
  supplier_id: { path: 'supplier_id', label: 'Supplier', type: 'string' },
  customer_id: { path: 'customer_id', label: 'Customer', type: 'string' },
  quantity: { path: 'quantity', label: 'Quantity', type: 'number' },
  uom: { path: 'uom', label: 'Unit of measure', type: 'string' },
  status: { path: 'status', label: 'Status', type: 'string', semantic: 'status' },
} satisfies Record<string, QueryField>;

/**
 * Returns cloned parameter descriptors for the supplied keys.
 *
 * Cloning avoids accidental cross-query mutation when later slices augment
 * per-entry defaults or required flags.
 *
 * @param keys - Common parameter keys to include.
 * @returns Query parameter definitions copied for a specific entry.
 */
export function params(...keys: Array<keyof typeof commonParams>): QueryParam[] {
  return keys.map((key) => ({ ...commonParams[key] }));
}

/**
 * Returns cloned field descriptors for the supplied keys.
 *
 * @param keys - Common field keys to include.
 * @returns Query field definitions copied for a specific entry.
 */
export function fields(...keys: Array<keyof typeof commonFields>): QueryField[] {
  return keys.map((key) => ({ ...commonFields[key] }));
}

/**
 * Canonical API prefix per backend, keyed by the domain name used in the
 * platform query catalog.  All warehouse-management queries route through
 * `/api/wh360`; order-history and quality analytics through `/api/poh`.
 */
export const platformApiPrefixes = {
  warehouse360: '/api/wh360',
  poh: '/api/poh',
  spc: '/api/spc',
} as const;

/** Closed union of valid query-catalog API domains. */
export type ApiDomain = keyof typeof platformApiPrefixes;

/**
 * Builds a type-safe platform API endpoint path for the supplied domain/query.
 *
 * @param domain - Typed domain key from {@link platformApiPrefixes}.
 * @param slug - Optional endpoint slug appended after the prefix.
 * @returns Relative API path for the registry entry.
 */
export function apiEndpoint(domain: ApiDomain, slug?: string): string {
  const prefix = platformApiPrefixes[domain];
  return slug ? `${prefix}/${slug}` : prefix;
}

/**
 * Returns a POST-backed query entry with the required registry shape.
 *
 * The platform catalog currently standardizes on POST endpoints to align with
 * the rest of the frontend request conventions.
 *
 * @param entry - Query metadata without the HTTP method.
 * @returns Query registry entry with `method: 'POST'`.
 */
export function postQuery(
  entry: Omit<QueryRegistryEntry, 'method'>,
): QueryRegistryEntry {
  return {
    ...entry,
    method: 'POST',
  };
}

/**
 * Returns a GET-backed query entry with the required registry shape.
 *
 * @param entry - Query metadata without the HTTP method.
 * @returns Query registry entry with `method: 'GET'`.
 */
export function getQuery(
  entry: Omit<QueryRegistryEntry, 'method'>,
): QueryRegistryEntry {
  return {
    ...entry,
    method: 'GET',
  };
}
