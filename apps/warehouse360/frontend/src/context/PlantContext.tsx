import React from 'react'

const STORAGE_KEY = 'warehouse360:plant-id'

/** A single plant record returned by the /api/plants endpoint. */
export interface Plant {
  plant_id: string
  plant_name: string
}

/** Value shape provided by PlantContext. */
interface PlantContextValue {
  plants: Plant[]
  selectedPlantId: string
  selectedPlant: Plant | null
  setSelectedPlantId: (plantId: string) => void
  loading: boolean
  error: string | null
}

const PlantContext = React.createContext<PlantContextValue>({
  plants: [],
  selectedPlantId: '',
  selectedPlant: null,
  setSelectedPlantId: () => {},
  loading: false,
  error: null,
})

/** Normalises raw rows from the API into typed Plant records. */
const normalisePlants = (rows: unknown): Plant[] => {
  const plants = Array.isArray(rows) ? rows : []
  return (plants as Record<string, unknown>[])
    .map((plant) => ({
      plant_id: String(plant['plant_id'] ?? '').trim(),
      plant_name: String(plant['plant_name'] ?? plant['plant_id'] ?? '').trim(),
    }))
    .filter((plant) => plant.plant_id.length > 0)
}

/** Reads the last-used plant id from localStorage (returns null on failure). */
const readStoredPlant = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persists the selected plant id to localStorage (no-op if unavailable). */
const storePlant = (plantId: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, plantId)
  } catch {
    // Plant selection still works for this session when storage is unavailable.
  }
}

/** Provides plant list, selection state, and setter to the component tree. */
export const PlantProvider = ({ children }: { children: React.ReactNode }) => {
  const [plants, setPlants] = React.useState<Plant[]>([])
  const [selectedPlantId, setSelectedPlantIdRaw] = React.useState<string>(
    () => readStoredPlant() ?? '',
  )
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/plants')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<{ plants?: unknown[] }>
      })
      .then((json) => {
        if (cancelled) return
        const nextPlants = normalisePlants(json?.plants)
        setPlants(nextPlants)
        setSelectedPlantIdRaw((current) =>
          nextPlants.some((plant) => plant.plant_id === current)
            ? current
            : nextPlants[0]?.plant_id ?? '',
        )
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setPlants([])
        setSelectedPlantIdRaw('')
        setError(err.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const setSelectedPlantId = React.useCallback((plantId: string) => {
    setSelectedPlantIdRaw(plantId)
    storePlant(plantId)
  }, [])

  const selectedPlant = React.useMemo(
    () => plants.find((plant) => plant.plant_id === selectedPlantId) ?? plants[0] ?? null,
    [plants, selectedPlantId],
  )

  const value = React.useMemo<PlantContextValue>(() => ({
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
export const usePlantSelection = () => React.useContext(PlantContext)
