import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MultivariateView from '../multivariate/MultivariateView'
import React from 'react'

// Mock context
vi.mock('../SPCContext', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSPCSelector: vi.fn((selector) => selector({
      selectedMaterial: { material_id: 'M1', material_name: 'Mat 1' },
      selectedPlant: null,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      selectedMultivariateMicIds: ['C1', 'C2'],
    }))
  }
})

vi.mock('../hooks/useMultivariate', () => ({
  useMultivariate: vi.fn(() => ({
    result: {
      n_observations: 2,
      n_variables: 2,
      ucl: 5.5,
      points: [
        { index: 0, batch_id: 'B1', t2: 2.0, is_anomaly: false, contributions: [], top_contributors: [] },
        { index: 1, batch_id: 'B2', t2: 6.0, is_anomaly: true, contributions: [], top_contributors: [] }
      ],
      anomalies: [
        { index: 1, batch_id: 'B2', t2: 6.0, summary: 'High C1' }
      ],
      correlation: { pairs: [], mics: [] }
    },
    loading: false,
    fetchMultivariate: vi.fn(),
    clear: vi.fn()
  }))
}))

// Mock charts
vi.mock('../charts/EChart', () => ({ default: () => <div data-testid="mock-echart" /> }))
vi.mock('../charts/CorrelationMatrix', () => ({ default: () => <div data-testid="mock-corr" /> }))

describe('MultivariateView', () => {
  it('renders control chart and root cause suggestions', () => {
    render(<MultivariateView />)
    expect(screen.getByText(/Run Multivariate SPC/i)).toBeInTheDocument()
    expect(screen.getByText('2 shared batches')).toBeInTheDocument()
    expect(screen.getByText('High C1')).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-echart').length).toBeGreaterThan(0)
  })
})
