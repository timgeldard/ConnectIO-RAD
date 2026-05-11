import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { 
  usePlants, useFloors, useLocations, useHeatmap, useMics, useTrends,
  useLots, useLotDetail, useLocationSummary, useUnmappedLocations,
  useMappedLocations, useSaveCoordinate, useDeleteCoordinate,
  usePlantGeoConfig, useUpsertPlantGeo, useAddFloor, useDeleteFloor
} from '../client'
import { fetchJson } from '@connectio/shared-frontend-api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@connectio/shared-frontend-api', () => ({
  fetchJson: vi.fn(),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('EM API client hooks', () => {
  it('usePlants fetches plants', async () => {
    vi.mocked(fetchJson).mockResolvedValue([{ plant_id: 'C351' }])
    const { result } = renderHook(() => usePlants(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchJson).toHaveBeenCalledWith('/api/em/plants?days=30')
  })

  it('useFloors requires plantId', async () => {
    const { result } = renderHook(() => useFloors('C351'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchJson).toHaveBeenCalledWith('/api/em/floors?plant_id=C351')
  })

  it('useLocations builds query params', async () => {
    const { result } = renderHook(() => useLocations('C351', 'F1', true), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const call = vi.mocked(fetchJson).mock.calls.find(c => c[0].includes('/api/em/locations'))
    expect(call![0]).toContain('plant_id=C351')
    expect(call![0]).toContain('floor_id=F1')
    expect(call![0]).toContain('mapped_only=true')
  })

  it('useHeatmap builds complex params', async () => {
    const { result } = renderHook(() => useHeatmap('C351', 'F1', 'deterministic', 30, '2026-01-01', 0.1, ['M1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const call = vi.mocked(fetchJson).mock.calls.find(c => c[0].includes('/api/em/heatmap'))
    expect(call![0]).toContain('plant_id=C351')
    expect(call![0]).toContain('as_of_date=2026-01-01')
    expect(call![0]).toContain('mics=M1')
  })

  it('useMics handles optional funcLocId', async () => {
    renderHook(() => useMics('C351', 'LOC1'), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('func_loc_id=LOC1'))
  })

  it('useTrends requires all IDs', async () => {
    renderHook(() => useTrends('C351', 'LOC1', 'MIC1', 60), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('window_days=60'))
  })

  it('useLots fetches lots', async () => {
    renderHook(() => useLots('C351', 'LOC1', 90), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('time_window_days=90'))
  })

  it('useLotDetail fetches single lot', async () => {
    renderHook(() => useLotDetail('C351', 'LOT1'), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/lots/LOT1?plant_id=C351')
  })

  it('useLocationSummary fetches summary', async () => {
    renderHook(() => useLocationSummary('C351', 'LOC/1'), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/locations/LOC%2F1/summary?plant_id=C351')
  })

  it('useUnmappedLocations fetches unmapped', async () => {
    renderHook(() => useUnmappedLocations('C351'), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/coordinates/unmapped?plant_id=C351')
  })

  it('useMappedLocations fetches mapped', async () => {
    renderHook(() => useMappedLocations('C351'), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/coordinates/mapped?plant_id=C351')
  })

  it('useSaveCoordinate mutation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({})
    const { result } = renderHook(() => useSaveCoordinate(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ plant_id: 'C351', func_loc_id: 'L1', x_pos: 10, y_pos: 20 })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/coordinates', expect.objectContaining({ method: 'POST' }))
  })

  it('useDeleteCoordinate mutation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({})
    const { result } = renderHook(() => useDeleteCoordinate(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ plantId: 'C351', funcLocId: 'L1' })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/coordinates/L1?plant_id=C351', expect.objectContaining({ method: 'DELETE' }))
  })

  it('usePlantGeoConfig fetches geo', async () => {
    renderHook(() => usePlantGeoConfig(), { wrapper: createWrapper() })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/plant-geo')
  })

  it('useUpsertPlantGeo mutation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({})
    const { result } = renderHook(() => useUpsertPlantGeo(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ plantId: 'C351', lat: 1, lon: 2 })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/plant-geo/C351', expect.objectContaining({ method: 'PUT' }))
  })

  it('useAddFloor mutation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({})
    const { result } = renderHook(() => useAddFloor(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ plant_id: 'C351', floor_id: 'F2', floor_name: 'Floor 2' })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/floors', expect.objectContaining({ method: 'POST' }))
  })

  it('useDeleteFloor mutation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({})
    const { result } = renderHook(() => useDeleteFloor(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ plantId: 'C351', floorId: 'F1' })
    expect(fetchJson).toHaveBeenCalledWith('/api/em/floors/F1?plant_id=C351', expect.objectContaining({ method: 'DELETE' }))
  })
})
