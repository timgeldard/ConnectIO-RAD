import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloorView from '../FloorView'
import React from 'react'

vi.mock('~/context/EMContext', () => ({
  useEM: () => ({ selectedLocId: null })
}))

vi.mock('~/api/client', () => ({
  useFloors: () => ({ 
    data: [
      { floor_id: 'F1', floor_name: 'Ground Floor' },
      { floor_id: 'F2', floor_name: 'First Floor' }
    ] 
  })
}))

vi.mock('~/components/controls/FilterBar', () => ({ default: () => <div data-testid="mock-filter-bar" /> }))
vi.mock('~/components/floorplan/FloorPlan', () => ({ default: () => <div data-testid="mock-floorplan" /> }))
vi.mock('~/components/sidepanel/LocationPanel', () => ({ default: () => <div data-testid="mock-sidepanel" /> }))

describe('FloorView', () => {
  const defaultProps = {
    plantId: 'P1',
    floorId: 'F1',
    personaId: 'regional' as any,
    onBack: vi.fn(),
    onBackToSite: vi.fn(),
    onChangeFloor: vi.fn(),
  }

  it('renders breadcrumbs and floor switcher', () => {
    render(<FloorView {...defaultProps} />)
    expect(screen.getByText('Ground Floor')).toBeInTheDocument()
    expect(screen.getByText('F2')).toBeInTheDocument()
  })

  it('calls onBack when Portfolio is clicked', () => {
    render(<FloorView {...defaultProps} />)
    fireEvent.click(screen.getByText(/Portfolio/i))
    expect(defaultProps.onBack).toHaveBeenCalled()
  })
})
