/* eslint-disable jsdoc/require-jsdoc */
import { useQuery } from '@tanstack/react-query'
import { usePlantSelection } from '~/context/PlantContext'
import { resolveWarehouseApiPath } from '~/api/apiBase'

/** Appends plant_id query param to API paths that don't already have it. */
const withPlantId = (path: string, plantId: string): string => {
  if (!plantId || !path.startsWith('/api/') || path.startsWith('/api/plants')) return path
  const url = new URL(path, window.location.origin)
  if (!url.searchParams.has('plant_id')) url.searchParams.set('plant_id', plantId)
  return `${url.pathname}${url.search}`
}

/** Reactive fetch state returned by useApi. */
export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetches a backend API endpoint using TanStack Query.
 * Provides automatic caching, deduplication, and background refetching.
 *
 * @param path - Relative API path, e.g. '/api/kpis'
 * @param deps - Extra dependencies (integrated into queryKey)
 */
export function useApi<T = unknown>(path: string, deps: unknown[] = []): ApiState<T> {
  const { selectedPlantId } = usePlantSelection()
  const requestPath = resolveWarehouseApiPath(withPlantId(path, selectedPlantId))

  const { data, isLoading, error } = useQuery<T>({
    queryKey: [requestPath, ...deps],
    queryFn: async () => {
      const res = await fetch(requestPath)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return res.json() as Promise<T>
    },
    // Standard cockpit caching: 30s stale time
    staleTime: 30_000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null
  }
}
