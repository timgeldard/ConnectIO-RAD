import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCharacteristics } from '../hooks/useCharacteristics'
import { useValidateMaterial } from '../hooks/useMaterials'
import { usePlants } from '../hooks/usePlants'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the API calls
vi.mock('../../api/spc', () => ({
  fetchCharacteristics: vi.fn(() => Promise.resolve({ characteristics: [{ mic_id: 'C1' }], attrCharacteristics: [] })),
  fetchPlants: vi.fn(() => Promise.resolve([{ plant_id: 'P1', plant_name: 'Plant 1' }])),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('SPC Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('useCharacteristics fetches data when materialId is provided', async () => {
    const { result } = renderHook(() => useCharacteristics('M1', 'P1'), { wrapper: createWrapper() })
    
    // Wait for the query to resolve
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    
    expect(result.current.characteristics).toHaveLength(1)
    expect(result.current.characteristics[0].mic_id).toBe('C1')
  })

  it('useValidateMaterial calls API and updates state', async () => {
    const mockResponse = { material_id: 'M1', material_name: 'Mat 1' }
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const { result } = renderHook(() => useValidateMaterial())

    let valResult: any
    await act(async () => {
      valResult = await result.current.validateMaterial('M1')
    })

    expect(valResult).toEqual(mockResponse)
    expect(result.current.result).toEqual(mockResponse)
    expect(result.current.error).toBeNull()
  })

  it('usePlants fetches plants list', async () => {
    const { result } = renderHook(() => usePlants('M1'), { wrapper: createWrapper() })
    
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    
    expect(result.current.plants).toHaveLength(1)
    expect(result.current.plants[0].plant_id).toBe('P1')
  })
})
