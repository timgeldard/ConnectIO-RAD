import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YieldAnalyticsPage } from '../pages/YieldAnalytics'
import { LangProvider } from '../i18n/context'
import { PlantProvider } from '@connectio/shared-app-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock API
vi.mock('../api/yield', () => ({
  fetchYieldAnalytics: vi.fn(() => Promise.resolve({
    now_ms: Date.now(),
    target_yield_pct: 95,
    orders: [
      { process_order_id: '1001', material_id: 'M1', material_name: 'Product 1', yield_pct: 96.5, loss_kg: 10 }
    ],
    prior7d: [],
    daily30d: [],
    hourly24h: [],
    materials: []
  }))
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <PlantProvider appName="poh">
        {children}
      </PlantProvider>
    </LangProvider>
  </QueryClientProvider>
)

describe('YieldAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders Yield analytics dashboard', async () => {
    render(<YieldAnalyticsPage />, { wrapper })
    
    expect(await screen.findByRole('heading', { name: /yield analytics/i })).toBeDefined()
    expect(await screen.findAllByText(/96\.5/)).toBeDefined()
  })

  it('renders material yield table', async () => {
    render(<YieldAnalyticsPage />, { wrapper })
    
    expect(await screen.findByText(/Product 1/i)).toBeDefined()
    expect(screen.getAllByText(/96\.5/)).toHaveLength(2) // KPI and row
  })
})
