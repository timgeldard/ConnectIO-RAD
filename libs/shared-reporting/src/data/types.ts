/**
 * Types for the dashboard data-binding system.
 * 
 * These types define how a widget can bind its properties to a live query
 * result from the platform query registry.
 */

/** Binds a query parameter to a global dashboard parameter (e.g. from a filter). */
export type DashboardParameterBinding = {
  /** The key of the dashboard parameter to bind to. */
  dashboardParam: string;
};

/** Binds a query parameter to a fixed static value. */
export type StaticParameterBinding = {
  /** The literal value to use for the parameter. */
  value: unknown;
};

/** Union of supported parameter binding types. */
export type QueryParamBinding = DashboardParameterBinding | StaticParameterBinding;

/** 
 * Supported data transformations for mapping query response fields to widget props.
 */
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

/** 
 * Configuration for a single property mapping. 
 * Can be a simple dot-path string or a detailed object with transform logic.
 */
export type MappingValue =
  | string
  | {
      /** Dot-path to the field in the query response payload. */
      path: string;
      /** Optional transform to apply to the raw value. */
      transform?: MappingTransform;
      /** Optional metadata for advanced transforms (e.g. field keys in arrays). */
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
