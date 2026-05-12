import { useQuery } from '@tanstack/react-query';
import type { QueryRegistry } from './queryRegistry';
import type { WidgetDataBinding, QueryParamBinding } from './types';
import { mapResponseToWidgetProps } from './mapping';

interface UseWidgetDataBindingOptions {
  binding?: WidgetDataBinding;
  queryRegistry: QueryRegistry;
  dashboardParams?: Record<string, unknown>;
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
 */
export function useWidgetDataBinding({
  binding,
  queryRegistry,
  dashboardParams = {},
  enabled = true,
}: UseWidgetDataBindingOptions) {
  const queryEntry = binding ? queryRegistry[binding.queryKey] : null;
  const resolvedParams = binding?.params ? resolveParams(binding.params, dashboardParams) : {};

  const query = useQuery({
    queryKey: ['widget-data', binding?.queryKey, resolvedParams],
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
