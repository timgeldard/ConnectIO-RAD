import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePlantMapData } from '../usePlantMapData'

describe('usePlantMapData', () => {
  const mockPlants = [
    { plant_id: 'P1', plant_name: 'B', region: 'EMEA', kpis: { risk_index: 10, active_fails: 5, pass_rate: 90 } },
    { plant_id: 'P2', plant_name: 'A', region: 'APAC', kpis: { risk_index: 20, active_fails: 2, pass_rate: 80 } },
  ]

  it('filters by region', () => {
    const { result } = renderHook(() => usePlantMapData(mockPlants as any, 'EMEA', 'name'))
    expect(result.current.scopedPlants).toHaveLength(1)
    expect(result.current.scopedPlants[0].plant_id).toBe('P1')
  })

  it('sorts by name', () => {
    const { result } = renderHook(() => usePlantMapData(mockPlants as any, 'ALL', 'name'))
    expect(result.current.sortedPlants[0].plant_name).toBe('A')
    expect(result.current.sortedPlants[1].plant_name).toBe('B')
  })

  it('sorts by fails', () => {
    const { result } = renderHook(() => usePlantMapData(mockPlants as any, 'ALL', 'fails'))
    expect(result.current.sortedPlants[0].kpis.active_fails).toBe(5)
    expect(result.current.sortedPlants[1].kpis.active_fails).toBe(2)
  })
})
