import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TrendTab from '../TrendTab'
import LotsTab from '../LotsTab'
import LocationPanel from '../LocationPanel'

// Mock context and hooks
vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    timeWindow: 30,
    view: { plantId: 'P1' },
    selectedLocId: 'L1',
    setSelectedLocId: vi.fn(),
  })
}))

vi.mock('~/api/client', () => ({
  useMics: () => ({ data: ['MIC1'], isLoading: false }),
  useTrends: () => ({ data: { points: [{ inspection_date: '2024-01-01', result_value: 10 }] }, isLoading: false }),
  useLots: () => ({ data: [{ lot_id: 'LOT1', status: 'PASS', inspection_start_date: '2024-01-01' }], isLoading: false }),
  useLotDetail: () => ({ data: { mic_results: [{ mic_id: 'M1', mic_name: 'MIC 1', result_value: 10, valuation: 'A' }] }, isLoading: false }),
  useLocationSummary: () => ({ data: { meta: { func_loc_name: 'Loc Name', plant_id: 'P1', floor_id: 'F1' }, mics: ['MIC1'], recent_lots: [{ status: 'PASS' }] } })
}))

describe('SidePanel Components', () => {
  it('renders LocationPanel with header and tabs', () => {
    render(<LocationPanel />)
    expect(screen.getByText('Loc Name')).toBeInTheDocument()
    expect(screen.getByText('trend')).toBeInTheDocument()
    expect(screen.getByText('lots')).toBeInTheDocument()
  })

  it('renders TrendTab with chart', () => {
    render(<TrendTab plantId="P1" funcLocId="L1" />)
    expect(screen.getByText(/MIC · MIC1/i)).toBeInTheDocument()
    expect(document.querySelector('svg.trend-chart')).toBeInTheDocument()
  })

  it('renders LotsTab and expands a lot row', () => {
    render(<LotsTab plantId="P1" funcLocId="L1" />)
    expect(screen.getByText('LOT1')).toBeInTheDocument()
    
    // Click to expand
    fireEvent.click(screen.getByText('LOT1'))
    expect(screen.getByText('MIC results')).toBeInTheDocument()
    expect(screen.getByText('MIC 1')).toBeInTheDocument()
  })
})
