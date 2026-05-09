import { useQuery } from '@tanstack/react-query'
import { fetchPlants } from '../../api/spc'
import type { PlantRef } from '../types'
import { spcQueryKeys } from '../queryKeys'

interface UsePlantsResult {
  plants: PlantRef[]
  loading: boolean
  error: string | null
}

export function usePlants(materialId: string | null | undefined): UsePlantsResult {
  const query = useQuery({
    queryKey: spcQueryKeys.plants(materialId),
    queryFn: ({ signal }) => fetchPlants(materialId as string, signal),
    enabled: Boolean(materialId),
    staleTime: 5 * 60_000,
  })

  const sorted = (query.data ?? []).slice().sort(
    (a, b) => (a.plant_id ?? '').localeCompare(b.plant_id ?? ''),
  )
  return {
    plants: materialId ? sorted : [],
    loading: query.isLoading || query.isFetching,
    error: query.error ? String(query.error) : null,
  }
}
