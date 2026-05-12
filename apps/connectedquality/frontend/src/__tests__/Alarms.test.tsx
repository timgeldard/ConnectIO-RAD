/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Alarms } from '../pages/Alarms'
import { fetchJson } from '@connectio/shared-frontend-api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@connectio/shared-frontend-api', () => ({
  fetchJson: vi.fn(),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('Alarms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders loading state', () => {
    vi.mocked(fetchJson).mockReturnValue(new Promise(() => {}))
    render(<Alarms />, { wrapper })
    
    expect(screen.getByText('Open')).toBeDefined()
    expect(screen.getAllByText('…')).toHaveLength(3)
  })

  it('renders alarm stream after load', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      total: 1,
      open: 1,
      alarms: [
        { id: '1', source: 'TRACE', rule: 'Late Order', status: 'open', severity: 'critical' }
      ]
    })
    
    render(<Alarms />, { wrapper })
    
    expect(await screen.findByText('TRACE')).toBeDefined()
    expect(screen.getByText('Late Order')).toBeDefined()
    expect(screen.getByText('open')).toBeDefined()
  })

  it('renders error state', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('API Down'))
    
    render(<Alarms />, { wrapper })
    
    expect(await screen.findByText(/Unable to load live alarms/)).toBeDefined()
  })
})
