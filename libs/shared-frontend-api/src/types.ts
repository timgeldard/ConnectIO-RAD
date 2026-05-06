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
