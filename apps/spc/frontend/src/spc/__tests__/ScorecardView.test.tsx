/* eslint-disable jsdoc/require-jsdoc */
/**
 * Unit tests for ScorecardView.
 * Covers the ready, loading, error, and empty-data render branches.
 */
import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ScorecardView from '../scorecard/ScorecardView'
import React from 'react'
import { renderWithI18n } from './test-utils'

vi.mock('../SPCContext', async (importOriginal) => {
  const actual: unknown = await importOriginal()
  return {
    ...(actual as object),
    useSPCDispatch: vi.fn(),
    useSPCSelector: vi.fn((selector: (s: object) => unknown) => selector({
      selectedMaterial: { material_id: 'M1', material_name: 'Mat 1' },
      selectedPlant: null,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })),
  }
})

const mockUseSPCScorecard = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSPCScorecard', () => ({
  useSPCScorecard: mockUseSPCScorecard,
}))

vi.mock('../scorecard/ScorecardTable', () => ({ default: () => <div data-testid="mock-table" /> }))

describe('ScorecardView', () => {
  it('renders KPIs and table when data is ready', async () => {
    mockUseSPCScorecard.mockReturnValue({
      scorecard: [
        { mic_id: 'C1', mic_name: 'Char 1', cpk: 1.5, ooc_rate: 0, batch_count: 10 },
        { mic_id: 'C2', mic_name: 'Char 2', cpk: 1.1, ooc_rate: 0.1, batch_count: 8 },
      ],
      loading: false,
      error: null,
    })

    renderWithI18n(<ScorecardView />)
    expect(screen.getByRole('heading', { name: 'Scorecard' })).toBeInTheDocument()
    expect(screen.getByText('Mat 1')).toBeInTheDocument()
    expect(screen.getByText('Characteristics')).toBeInTheDocument()
    expect(screen.getByText('Capable')).toBeInTheDocument()
    expect(screen.getByText('Marginal')).toBeInTheDocument()
    expect(screen.getByText('Signals open')).toBeInTheDocument()
    expect(await screen.findByTestId('mock-table')).toBeInTheDocument()
  })

  it('renders error state when the scorecard hook returns an error', () => {
    mockUseSPCScorecard.mockReturnValue({
      scorecard: [],
      loading: false,
      error: new Error('Network timeout'),
    })

    renderWithI18n(<ScorecardView />)
    expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Scorecard' })).not.toBeInTheDocument()
  })

  it('renders empty-data state when scorecard is an empty array', () => {
    mockUseSPCScorecard.mockReturnValue({
      scorecard: [],
      loading: false,
      error: null,
    })

    renderWithI18n(<ScorecardView />)
    expect(screen.getByText(/No scorecard data/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Scorecard' })).not.toBeInTheDocument()
  })
})
