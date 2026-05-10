/**
 * Standard interface for API responses that may be conditionally available.
 * 
 * When data_available is false, components should render an appropriate
 * empty state or "Feature coming soon" banner using the provided reason.
 */
export interface DataAvailableResponse {
  /** 
   * Indicates if real data is available. 
   * If false, the feature is likely stubbed or pending backend views.
   */
  data_available?: boolean;
  
  /** 
   * Machine-readable reason for data unavailability.
   * e.g., 'gold_views_pending', 'no_data_in_range', 'unauthorized'
   */
  reason?: string;
}

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export interface PageResponse<T> extends DataAvailableResponse {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ManufacturingFilters {
  plantId?: string | null;
  materialId?: string | null;
  batchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
}

export interface ChartSeriesPoint {
  x: string | number;
  y: number;
  group?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityMutationContext<T> {
  previous?: T;
}
