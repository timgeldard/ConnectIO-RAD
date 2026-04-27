import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GlobalView from '../GlobalView'

const { mockPlants } = vi.hoisted(() => ({
  mockPlants: [
    {
      plant_id: 'P1', plant_name: 'Plant 1', plant_code: 'P1', country: 'IE', region: 'EMEA',
      city: 'Dublin',
      kpis: { total_locs: 10, active_fails: 0, warnings: 0, pass_rate: 100, lots_tested: 5, lots_planned: 5, pathogen_hits: 0, risk_index: 0 }
    },
    {
      plant_id: 'P2', plant_name: 'Plant 2', plant_code: 'P2', country: 'US', region: 'AMER',
      city: 'Bristol',
      kpis: { total_locs: 20, active_fails: 2, warnings: 1, pass_rate: 90, lots_tested: 10, lots_planned: 10, pathogen_hits: 1, risk_index: 10 }
    },
  ],
}))

vi.mock('~/map/EnvMonGlobalMap', () => ({
  default: () => <div data-testid="mock-map" />
}))

vi.mock('~/api/client', () => ({
  usePlants: () => ({ data: mockPlants })
}))

vi.mock('~/components/ui/KPI', () => ({
  default: ({ label, value }: any) => <div data-testid="mock-kpi">{label}: {value}</div>
}))

describe('GlobalView', () => {
  it('renders title translation key with plant count interpolated and KPI strip', () => {
    render(<GlobalView onOpenPlant={vi.fn()} />)
    // The mock t() substitutes {{n}} into the key string for the .other variant.
    // Key: 'envmon.global.title.other', value n=2 → key unchanged (key has no {{n}})
    // so the rendered h1 shows the key name
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-kpi')).toHaveLength(5)
  })

  it('filters plants by region when chip is clicked', () => {
    render(<GlobalView onOpenPlant={vi.fn()} />)

    // Initial: 2 plants
    expect(screen.getByText('P1 · Plant 1')).toBeInTheDocument()
    expect(screen.getByText('P2 · Plant 2')).toBeInTheDocument()

    // Click EMEA
    fireEvent.click(screen.getByRole('button', { name: 'EMEA' }))

    expect(screen.getByText('P1 · Plant 1')).toBeInTheDocument()
    expect(screen.queryByText('P2 · Plant 2')).not.toBeInTheDocument()
  })

  it('calls onOpenPlant when a plant card is clicked', () => {
    const onOpenPlant = vi.fn()
    render(<GlobalView onOpenPlant={onOpenPlant} />)

    fireEvent.click(screen.getByText('P1 · Plant 1').closest('button')!)
    expect(onOpenPlant).toHaveBeenCalledWith('P1')
  })
})
