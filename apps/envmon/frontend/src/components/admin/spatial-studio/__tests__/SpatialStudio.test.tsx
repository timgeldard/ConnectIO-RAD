/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SpatialStudio from '../SpatialStudio'

vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { plantId: 'P225', floorId: null, level: 'admin' },
  }),
}))

vi.mock('~/api/client', () => ({
  useFloors: () => ({
    data: [
      { floor_id: 'F1', floor_name: 'Ground Floor', location_count: 12, svg_url: null, svg_width: null, svg_height: null },
      { floor_id: 'F2', floor_name: 'First Floor', location_count: 8, svg_url: null, svg_width: null, svg_height: null },
    ],
    isLoading: false,
  }),
  useDraftLayout: () => ({ data: null, isLoading: false }),
  useCreateDraft: () => ({ mutate: vi.fn(), isPending: false }),
  useValidate: () => ({ mutate: vi.fn(), isPending: false }),
  usePublish: () => ({ mutate: vi.fn(), isPending: false }),
  useUpsertZone: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteZone: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('SpatialStudio', () => {
  it('renders without crash', () => {
    render(<SpatialStudio />)
    expect(screen.getByTestId('floor-selector')).toBeInTheDocument()
  })

  it('shows floor selector when no floor is selected', () => {
    render(<SpatialStudio />)
    expect(screen.getByText('Ground Floor')).toBeInTheDocument()
    expect(screen.getByText('First Floor')).toBeInTheDocument()
  })

  it('navigates into StudioShell after selecting a floor', () => {
    render(<SpatialStudio />)
    fireEvent.click(screen.getByText('Ground Floor'))
    // Back button and canvas should now be visible
    expect(screen.getByLabelText('Back to floor selector')).toBeInTheDocument()
    expect(screen.getByTestId('studio-canvas')).toBeInTheDocument()
  })
})
