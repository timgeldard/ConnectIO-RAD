import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloorPlan from '../FloorPlan'

// Mock context and hooks
vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { plantId: 'P1' },
    activeFloor: 'F1',
    heatmapMode: 'deterministic',
    timeWindow: 30,
    setSelectedLocId: vi.fn(),
    historicalDate: null,
    decayLambda: null,
    selectedMics: [],
  })
}))

vi.mock('~/api/client', () => ({
  useFloors: () => ({ data: [{ floor_id: 'F1', floor_name: 'Ground Floor', svg_url: null }] }),
  useHeatmap: () => ({ 
    data: { markers: [{ func_loc_id: 'L1', x_pos: 10, y_pos: 20, status: 'PASS' }] },
    isLoading: false,
    isError: false 
  })
}))

// Mock sub-components
vi.mock('../Marker', () => ({ default: () => <div data-testid="mock-marker" /> }))
vi.mock('../Tooltip', () => ({ default: () => <div data-testid="mock-tooltip" /> }))

describe('FloorPlan', () => {
  it('renders fallback grid and markers', () => {
    render(<FloorPlan />)
    expect(screen.getByLabelText(/Heatmap markers for floor F1/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-marker')).toBeInTheDocument()
    expect(screen.getByText('FAIL')).toBeInTheDocument() // In legend
  })
})
