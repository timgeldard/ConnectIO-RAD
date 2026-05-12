/**
 * Registry types for platform-owned queries.
 */

export type QueryValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateRange'
  | 'array'
  | 'object';

export interface QueryField {
  /** Dot-path to the field in the response payload. */
  path: string;
  /** Human-readable label for the field in the inspector mapping UI. */
  label: string;
  /** Expected data type. */
  type: QueryValueType;
  /** Optional semantic hint for mapping default transforms. */
  semantic?: 'percentage' | 'duration' | 'count' | 'status' | 'timeseries';
}

export interface QueryParam {
  /** The key expected by the API endpoint. */
  key: string;
  /** Human-readable label in the inspector param-binding UI. */
  label: string;
  /** The data type expected by the endpoint. */
  type: QueryValueType;
  /** If true, the query cannot be executed without a value for this param. */
  required?: boolean;
  /** Default value if not provided by the dashboard. */
  defaultValue?: unknown;
}

export interface QueryRegistryEntry {
  /** Unique key for the query (e.g. 'poh.oeeAnalytics'). */
  key: string;
  /** Display name shown in the query selector. */
  label: string;
  /** Optional documentation for the builder. */
  description?: string;
  /** The relative or absolute URL for the data fetch. */
  endpoint: string;
  /** HTTP method; defaults to GET. */
  method?: 'GET' | 'POST';
  /** List of widget types (e.g. ['kpi', 'trend']) compatible with this query. */
  compatibleWidgets: string[];
  /** Parameters accepted by this query. */
  params: QueryParam[];
  /** Discoverable fields in the response for mapping. */
  fields: QueryField[];
  /** Optional mock response for builder previews. */
  sampleResponse?: unknown;
}

export type QueryRegistry = Record<string, QueryRegistryEntry>;
