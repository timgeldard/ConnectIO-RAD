import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ScorecardView from '../scorecard/ScorecardView'
import React from 'react'
import { renderWithI18n } from './test-utils'

// Mock context and hooks
vi.mock('../SPCContext', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSPCDispatch: vi.fn(),
    useSPCSelector: vi.fn((selector) => selector({
      selectedMaterial: { material_id: 'M1', material_name: 'Mat 1' },
      selectedPlant: null,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    }))
  }
})

vi.mock('../hooks/useSPCScorecard', () => ({
  useSPCScorecard: vi.fn(() => ({
    scorecard: [
      { mic_id: 'C1', mic_name: 'Char 1', cpk: 1.5, ooc_rate: 0 },
      { mic_id: 'C2', mic_name: 'Char 2', cpk: 1.1, ooc_rate: 0.1 }
    ],
    loading: false
  }))
}))

vi.mock('../scorecard/ScorecardTable', () => ({ default: () => <div data-testid="mock-table" /> }))

describe('ScorecardView', () => {
  it('renders KPIs and table when data is ready', async () => {
    renderWithI18n(<ScorecardView />)
    expect(screen.getByRole('heading', { name: 'Scorecard' })).toBeInTheDocument()
    expect(screen.getByText('Mat 1')).toBeInTheDocument()
    expect(screen.getByText('Characteristics')).toBeInTheDocument()
    expect(screen.getByText('Capable')).toBeInTheDocument()
    expect(screen.getByText('Marginal')).toBeInTheDocument()
    expect(screen.getByText('Signals open')).toBeInTheDocument()
    expect(await screen.findByTestId('mock-table')).toBeInTheDocument()
  })
})
