import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CoordinateMapper from '../CoordinateMapper'

// Mock context and all hooks used by CoordinateMapper
vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { plantId: 'P1' },
    activeFloor: 'F1',
    setActiveFloor: vi.fn(),
    timeWindow: 30,
  })
}))

vi.mock('~/api/client', () => ({
  usePlants: () => ({ data: [{ plant_id: 'P1', plant_name: 'Plant 1', plant_code: 'P1' }] }),
  useFloors: () => ({ data: [{ floor_id: 'F1', floor_name: 'Ground Floor', location_count: 5 }] }),
  useUnmappedLocations: () => ({ data: [] }),
  useMappedLocations: () => ({ data: [] }),
  useSaveCoordinate: () => ({ mutate: vi.fn() }),
  useDeleteCoordinate: () => ({ mutate: vi.fn() }),
  useHeatmap: () => ({ data: { markers: [] } }),
  useAddFloor: () => ({ mutate: vi.fn() }),
  useDeleteFloor: () => ({ mutate: vi.fn() }),
  usePlantGeoConfig: () => ({ data: [] }),
  useUpsertPlantGeo: () => ({ mutate: vi.fn() }),
}))

describe('CoordinateMapper', () => {
  it('renders admin tab buttons using translation keys', () => {
    render(<CoordinateMapper />)
    // Tab labels now use translated keys via mock t()
    expect(screen.getByText('envmon.admin.tab.floorPlan')).toBeInTheDocument()
    expect(screen.getByText('envmon.admin.tab.mapPins')).toBeInTheDocument()
  })

  it('renders plant name in plant selector', () => {
    render(<CoordinateMapper />)
    expect(screen.getByText(/Plant 1/i)).toBeInTheDocument()
  })

  it('renders floor list', () => {
    render(<CoordinateMapper />)
    expect(screen.getAllByText('Ground Floor').length).toBeGreaterThan(0)
  })
})
