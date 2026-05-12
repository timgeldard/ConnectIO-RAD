import { useQuery } from '@tanstack/react-query';
import type { QueryRegistry } from './queryRegistry';
import type { WidgetDataBinding, QueryParamBinding } from './types';
import { mapResponseToWidgetProps } from './mapping';

/** Options for the useWidgetDataBinding hook. */
export interface UseWidgetDataBindingOptions {
  /** The data binding configuration from the widget. */
  binding?: WidgetDataBinding;
  /** The registry of available queries. */
  queryRegistry: QueryRegistry;
  /** Global dashboard parameters (e.g. from filters) for binding resolution. */
  dashboardParams?: Record<string, unknown>;
  /** Whether the query is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Resolves parameter bindings from dashboard context or static values.
 */
function resolveParams(
  bindings: Record<string, QueryParamBinding>,
  dashboardParams: Record<string, unknown>
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, binding] of Object.entries(bindings)) {
    if ('dashboardParam' in binding) {
      resolved[key] = dashboardParams[binding.dashboardParam];
    } else {
      resolved[key] = binding.value;
    }
  }
  return resolved;
}

/**
 * Hook to execute a widget's data binding query and map the results to props.
 * 
 * Handles parameter resolution (dashboard vs static), fetching from the registry endpoint,
 * and applying property transformations.
 * 
 * @param options - UseWidgetDataBindingOptions
 * @returns An object containing query status, error, and mappedProps
 */
export function useWidgetDataBinding({
  binding,
  queryRegistry,
  dashboardParams = {},
  enabled = true,
}: UseWidgetDataBindingOptions) {
  const queryEntry = binding ? queryRegistry[binding.queryKey] : null;
  const resolvedParams = binding?.params ? resolveParams(binding.params, dashboardParams) : {};
  
  // Use a stable string representation for the query key to avoid cache churn
  const stableParams = JSON.stringify(resolvedParams);

  const query = useQuery({
    queryKey: ['widget-data', binding?.queryKey, stableParams],
    queryFn: async () => {
      if (!queryEntry) throw new Error(`Query key "${binding?.queryKey}" not found in registry.`);

      const url = new URL(queryEntry.endpoint, window.location.origin);
      if (queryEntry.method !== 'POST') {
        Object.entries(resolvedParams).forEach(([k, v]) => {
          if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        });
      }

      const res = await fetch(url.toString(), {
        method: queryEntry.method ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: queryEntry.method === 'POST' ? JSON.stringify(resolvedParams) : undefined,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Fetch failed: ${res.status}`);
      }

      return res.json();
    },
    enabled: enabled && !!binding && !!queryEntry,
    staleTime: 30_000,
  });

  const mappedProps = query.data && binding?.mapping
    ? mapResponseToWidgetProps(query.data, binding.mapping)
    : {};

  return {
    ...query,
    mappedProps,
  };
}
