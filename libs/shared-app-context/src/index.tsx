/* eslint-disable jsdoc/require-jsdoc */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** A single plant record returned by plant endpoints. */
export interface Plant {
  plant_id: string
  plant_name: string
}

/** Value shape provided by PlantContext. */
export interface PlantContextValue {
  plants: Plant[]
  selectedPlantId: string
  selectedPlant: Plant | null
  setSelectedPlantId: (plantId: string) => void
  loading: boolean
  error: string | null
}

const PlantContext = createContext<PlantContextValue | null>(null)

/** Normalises raw rows from the API into typed Plant records. */
const normalisePlants = (rows: unknown): Plant[] => {
  const rawArray = Array.isArray(rows)
    ? rows
    : (rows != null && typeof rows === 'object' && 'plants' in rows && Array.isArray((rows as Record<string, unknown>).plants))
      ? (rows as Record<string, unknown>).plants as unknown[]
      : []
  return rawArray
    .map((plant) => {
      const p = plant as Record<string, unknown>
      return {
        plant_id: String(p['plant_id'] ?? '').trim(),
        plant_name: String(p['plant_name'] ?? p['plant_id'] ?? '').trim(),
      }
    })
    .filter((plant) => plant.plant_id.length > 0)
    .sort((a, b) => a.plant_id.localeCompare(b.plant_id))
}

const getStorageKey = (appName: string) => `connectio:${appName}:plant-id`

/** Provides plant list, selection state, and setter to the component tree. */
export interface PlantProviderProps {
  appName: string
  /** URL to fetch plants from, e.g. '/api/plants'. Defaults to '/api/plants'. */
  apiEndpoint?: string
  /** Optional initial plants to avoid the first fetch. */
  initialPlants?: Plant[]
  /** Optional custom fetcher. If provided, apiEndpoint is ignored. */
  fetcher?: (signal: AbortSignal) => Promise<Plant[]>
  /** Whether a plant MUST be selected. If false, selectedPlantId can be empty. Defaults to true. */
  requireSelection?: boolean
  children: ReactNode
}

export function PlantProvider({
  appName,
  apiEndpoint = '/api/plants',
  initialPlants = [],
  fetcher,
  requireSelection = true,
  children,
}: PlantProviderProps) {
  const storageKey = getStorageKey(appName)
  
  const readStoredPlant = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(storageKey)
    } catch {
      return null
    }
  }, [storageKey])

  const storePlant = useCallback((plantId: string | null): void => {
    try {
      if (plantId) {
        window.localStorage.setItem(storageKey, plantId)
      } else {
        window.localStorage.removeItem(storageKey)
      }
    } catch {
      // Persistence is a convenience, not a rendering requirement.
    }
  }, [storageKey])

  const [plants, setPlants] = useState<Plant[]>(initialPlants)
  const [selectedPlantId, setSelectedPlantIdRaw] = useState<string>(
    () => readStoredPlant() ?? '',
  )
  const [loading, setLoading] = useState(initialPlants.length === 0)
  const [error, setError] = useState<string | null>(null)

  const defaultFetcher = useCallback(async (signal: AbortSignal): Promise<Plant[]> => {
    const res = await fetch(apiEndpoint, { signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const json = await res.json()
    return normalisePlants(json)
  }, [apiEndpoint])

  useEffect(() => {
    if (initialPlants.length > 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    const abortController = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const nextPlants = fetcher 
          ? await fetcher(abortController.signal)
          : await defaultFetcher(abortController.signal)
        
        if (cancelled) return
        
        setPlants(nextPlants)
        setSelectedPlantIdRaw((current) => {
          if (nextPlants.some((p) => p.plant_id === current)) return current
          if (requireSelection && nextPlants.length > 0) return nextPlants[0].plant_id
          return ''
        })
      } catch (err: any) {
        if (cancelled) return
        if (err.name === 'AbortError') return
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [fetcher, defaultFetcher, initialPlants.length, requireSelection])

  const setSelectedPlantId = useCallback((plantId: string) => {
    setSelectedPlantIdRaw(plantId)
    storePlant(plantId || null)
  }, [storePlant])

  const selectedPlant = useMemo(
    () => plants.find((p) => p.plant_id === selectedPlantId) ?? (requireSelection ? plants[0] : null) ?? null,
    [plants, selectedPlantId, requireSelection],
  )

  const value = useMemo<PlantContextValue>(() => ({
    plants,
    selectedPlantId: selectedPlant?.plant_id ?? '',
    selectedPlant,
    setSelectedPlantId,
    loading,
    error,
  }), [plants, selectedPlant, setSelectedPlantId, loading, error])

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>
}

/** Hook to access the plant selection context. */
export function usePlantSelection(): PlantContextValue {
  const context = useContext(PlantContext)
  if (!context) {
    throw new Error('usePlantSelection must be used within a PlantProvider')
  }
  return context
}

export * from './PlantContextBar'
