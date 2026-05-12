/* eslint-disable jsdoc/require-jsdoc */
import { fetchJson } from './client'

export interface Plant {
  plant_id: string
  plant_name: string
}

export async function fetchPlants(): Promise<Plant[]> {
  const res = await fetchJson<{ plants: Plant[] }>('/api/plants', { credentials: 'include' })
  return (res.plants ?? []).slice().sort((a, b) => a.plant_id.localeCompare(b.plant_id))
}
