/**
 * Integration smoke test: proves the scorecard API round-trip through MSW fixtures
 * without a live Databricks connection. Exercises fetchScorecard → TanStack Query
 * → useSPCScorecard → ScorecardView render end-to-end.
 */
import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { mswServer } from './fixtures/mswServer'
import ScorecardView from '../scorecard/ScorecardView'
import React from 'react'
import { renderWithProviders } from './test-utils'

vi.mock('../SPCContext', async (importOriginal) => {
  const actual: unknown = await importOriginal()
  return {
    ...(actual as object),
    useSPCDispatch: vi.fn(),
    useSPCSelector: vi.fn((selector: (s: object) => unknown) => selector({
      selectedMaterial: { material_id: 'MAT-FIXTURE', material_name: 'Fixture Material' },
      selectedPlant: { plant_id: 'P001', plant_name: 'Kerry Shillelagh' },
      selectedMIC: null,
      exclusionAudit: [],
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      roleMode: 'viewer',
    })),
  }
})

vi.mock('../scorecard/ScorecardTable', () => ({ default: () => <div data-testid="mock-table" /> }))

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

describe('ScorecardView MSW integration', () => {
  it('renders KPI labels after fixture data loads', async () => {
    renderWithProviders(<ScorecardView />)

    // Wait for data to arrive and KPIs to render
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Scorecard' })).toBeInTheDocument(),
    )

    // Verify all four KPI tiles are rendered — the labels are the reliable signal
    expect(screen.getByText('Characteristics')).toBeInTheDocument()
    expect(screen.getByText('Capable')).toBeInTheDocument()
    expect(screen.getByText('Marginal')).toBeInTheDocument()
    expect(screen.getByText('Signals open')).toBeInTheDocument()
    expect(screen.getByText('Fixture Material')).toBeInTheDocument()
  })

  it('renders error state when scorecard endpoint returns 500', async () => {
    const { http, HttpResponse } = await import('msw')
    mswServer.use(
      http.post('/api/spc/scorecard', () =>
        HttpResponse.json({ detail: 'Internal server error' }, { status: 500 }),
      ),
    )

    renderWithProviders(<ScorecardView />)

    await waitFor(() =>
      expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument(),
    )
  })
})
