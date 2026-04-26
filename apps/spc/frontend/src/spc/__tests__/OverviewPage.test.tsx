import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import OverviewPage from '../overview/OverviewPage'
import React from 'react'

// Mock context
vi.mock('../SPCContext', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSPCDispatch: vi.fn(),
    useSPCSelector: vi.fn((selector) => selector({
      selectedMaterial: { material_id: 'M1', material_name: 'Mat 1' },
      selectedPlant: null,
      selectedMIC: null,
      processFlowUpstreamDepth: 4,
      processFlowDownstreamDepth: 3,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    }))
  }
})

// Mock hooks
vi.mock('../hooks/useSPCScorecard', () => ({
  useSPCScorecard: vi.fn(() => ({ scorecard: [], loading: false }))
}))
vi.mock('../hooks/useSPCFlow', () => ({
  useSPCFlow: vi.fn(() => ({ flowData: null, loading: false }))
}))

// Mock components
vi.mock('../flow/ProcessFlowMiniMap', () => ({ default: () => <div data-testid="mock-minimap" /> }))
vi.mock('../overview/KPICard', () => ({ default: ({ label }: any) => <div data-testid="mock-kpi">{label}</div> }))
vi.mock('../overview/RecentViolations', () => ({ default: () => <div data-testid="mock-violations" /> }))

describe('OverviewPage', () => {
  it('renders correctly with material selected', () => {
    render(<OverviewPage />)
    
    expect(screen.getByText(/Operational quality · SPC/i)).toBeInTheDocument()
    expect(screen.getByText('Mat 1 · All plants')).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-kpi').length).toBeGreaterThan(0)
    expect(screen.getByTestId('mock-violations')).toBeInTheDocument()
  })
})
