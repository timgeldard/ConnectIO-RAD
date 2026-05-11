/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LabBoard } from '../pages/lab/LabBoard'
import { fetchJson } from '@connectio/shared-frontend-api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as appContext from '@connectio/shared-app-context'

vi.mock('@connectio/shared-frontend-api', () => ({
  fetchJson: vi.fn(),
}))

vi.mock('@connectio/shared-app-context', async () => {
  const actual = await vi.importActual('@connectio/shared-app-context')
  return {
    ...actual,
    usePlantSelection: vi.fn(),
  }
})

const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('LabBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(appContext.usePlantSelection).mockReturnValue({
      plants: [{ plant_id: 'C351', plant_name: 'Kerry' }],
      selectedPlantId: 'C351',
      setSelectedPlantId: vi.fn(),
      loading: false,
    } as any)
  })

  it('renders fails after load', async () => {
    const mockFails = [{
      mat: 'Material 1',
      matNo: 'M1',
      lot: 'L1',
      batch: 'B1',
      line: 'L1',
      char: 'C1',
      text: 'T1',
      res: 10,
      lo: 5,
      hi: 15,
      units: 'U',
      sev: 'fail'
    }]
    vi.mocked(fetchJson).mockResolvedValue({ fails: mockFails, data_available: true })

    render(<LabBoard />, { wrapper })
    
    expect(await screen.findByText('Material 1')).toBeDefined()
    expect(screen.getByText('RESULT · FAIL')).toBeDefined()
  })

  it('shows no data message', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ fails: [], data_available: false, reason: 'No data' })

    render(<LabBoard />, { wrapper })
    
    expect(await screen.findByText('No data')).toBeDefined()
  })
})
