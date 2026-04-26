import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SiteView from '../SiteView'

vi.mock('~/api/client', () => ({
  useFloors: () => ({ 
    data: [
      { floor_id: 'F1', floor_name: 'Ground Floor', location_count: 5 },
    ] 
  })
}))

vi.mock('~/components/ui/KPI', () => ({
  default: ({ label, value }: any) => <div data-testid="mock-kpi">{label}: {value}</div>
}))

describe('SiteView', () => {
  const mockPlant = {
    plant_id: 'P1',
    plant_name: 'Seville',
    plant_code: 'P225',
    product: 'Spices',
    country: 'ES',
    employees: 150,
    kpis: {
      total_locs: 100,
      active_fails: 2,
      warnings: 5,
      pending: 3,
      pass_rate: 93.0,
      lots_planned: 10,
      lots_tested: 8,
    }
  }

  const defaultProps = {
    plant: mockPlant as any,
    onOpenFloor: vi.fn(),
    onBack: vi.fn(),
  }

  it('renders plant header and KPIs', () => {
    render(<SiteView {...defaultProps} />)
    expect(screen.getByText(/P225 · Seville/i)).toBeInTheDocument()
    expect(screen.getByText(/Spices · ES · 150 staff · 1 floors · 100 swab points/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-kpi').length).toBe(5)
  })

  it('calls onOpenFloor when a floor card is clicked', () => {
    render(<SiteView {...defaultProps} />)
    fireEvent.click(screen.getByText('Ground Floor').closest('button')!)
    expect(defaultProps.onOpenFloor).toHaveBeenCalledWith('F1')
  })
})
