/**
 * Types for the dashboard data-binding system.
 * 
 * These types define how a widget can bind its properties to a live query
 * result from the platform query registry.
 */

export type DashboardParameterBinding = {
  dashboardParam: string;
};

export type StaticParameterBinding = {
  value: unknown;
};

export type QueryParamBinding = DashboardParameterBinding | StaticParameterBinding;

export type MappingTransform =
  | 'identity'
  | 'number'
  | 'string'
  | 'percentage'
  | 'timeseriesPoints'
  | 'paretoItems'
  | 'barSeries'
  | 'tableRows'
  | 'spcPoints'
  | 'spcLimits';

export type MappingValue =
  | string
  | {
      path: string;
      transform?: MappingTransform;
      config?: Record<string, any>;
    };

/**
 * Configuration for a widget's live data binding.
 */
export interface WidgetDataBinding {
  /** Registry key matching an entry in the QueryRegistry. */
  queryKey: string;
  /** Parameters passed to the query, mapped from dashboard-level params or static values. */
  params?: Record<string, QueryParamBinding>;
  /** Mapping from response payload paths to widget property keys. */
  mapping?: Record<string, MappingValue>;
}
