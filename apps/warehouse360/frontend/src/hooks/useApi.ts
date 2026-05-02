import { useState, useEffect } from 'react'
import { usePlantSelection } from '~/context/PlantContext'

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
 * Fetches a backend API endpoint and returns reactive { data, loading, error }.
 * Auth is handled by the Databricks Apps proxy (x-forwarded-access-token injected
 * server-side), so no token handling is needed in the browser.
 *
 * @param path - Relative API path, e.g. '/api/kpis'
 * @param deps - Extra useEffect dependencies (re-fetch when these change)
 */
export function useApi<T = unknown>(path: string, deps: unknown[] = []): ApiState<T> {
  const { selectedPlantId } = usePlantSelection()
  const requestPath = withPlantId(path, selectedPlantId)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(requestPath)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<T>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPath, ...deps])

  return { data, loading, error }
}
