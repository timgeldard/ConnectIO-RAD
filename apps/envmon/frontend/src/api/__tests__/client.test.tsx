import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlants, useFloors, useHeatmap, useLocationSummary } from '../client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchJson } from '@connectio/shared-frontend-api'
import React from 'react'

// Mock shared-frontend-api
vi.mock('@connectio/shared-frontend-api', () => ({
  fetchJson: vi.fn()
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('EM API Client Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usePlants returns data from fetchJson', async () => {
    const mockData = [{ plant_id: 'P1', plant_name: 'Plant 1' }]
    vi.mocked(fetchJson).mockResolvedValue(mockData)

    const { result } = renderHook(() => usePlants(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(fetchJson).toHaveBeenCalledWith('/api/em/plants')
  })

  it('useFloors returns data when plantId is provided', async () => {
    const mockData = [{ floor_id: 'F1', floor_name: 'Floor 1' }]
    vi.mocked(fetchJson).mockResolvedValue(mockData)

    const { result } = renderHook(() => useFloors('P1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(fetchJson).toHaveBeenCalledWith('/api/em/floors?plant_id=P1')
  })

  it('useFloors is disabled when plantId is null', async () => {
    const { result } = renderHook(() => useFloors(null), { wrapper: createWrapper() })
    expect(result.current.isEnabled).toBe(false)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('useHeatmap fetches data with query params', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ markers: [] })
    const { result } = renderHook(() => useHeatmap('P1', 'F1', 'deterministic', 30), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('/api/em/heatmap?plant_id=P1&floor_id=F1'))
  })

  it('useLocationSummary fetches correctly', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ meta: {} })
    const { result } = renderHook(() => useLocationSummary('P1', 'L1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchJson).toHaveBeenCalledWith('/api/em/locations/L1/summary?plant_id=P1')
  })
})
