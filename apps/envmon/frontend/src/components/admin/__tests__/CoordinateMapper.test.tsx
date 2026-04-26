import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CoordinateMapper from '../CoordinateMapper'
import React from 'react'

// Mock context and all hooks used by CoordinateMapper
vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { plantId: 'P1' },
    activeFloor: 'F1',
    setActiveFloor: vi.fn(),
  })
}))

vi.mock('~/api/client', () => ({
  usePlants: () => ({ data: [{ plant_id: 'P1', plant_name: 'Plant 1' }] }),
  useFloors: () => ({ data: [{ floor_id: 'F1', floor_name: 'Ground Floor' }] }),
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
  it('renders tabs and plant name', () => {
    render(<CoordinateMapper />)
    expect(screen.getByText('Floor plan')).toBeInTheDocument()
    expect(screen.getByText('Map pins')).toBeInTheDocument()
    expect(screen.getByText(/Plant 1/i)).toBeInTheDocument()
  })

  it('renders floor list', () => {
    render(<CoordinateMapper />)
    expect(screen.getAllByText('Ground Floor').length).toBeGreaterThan(0)
  })
})
