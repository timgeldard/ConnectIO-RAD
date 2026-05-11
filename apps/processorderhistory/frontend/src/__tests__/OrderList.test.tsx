import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrderList } from '../pages/OrderList'
import { LangProvider } from '../i18n/context'
import { PlantProvider } from '@connectio/shared-app-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock API
vi.mock('../api/orders', () => ({
  fetchOrders: vi.fn(() => Promise.resolve({
    orders: [
      { id: '1001', product: { name: 'Nuggets', sku: 'S1', category: 'Cat1' }, status: 'running', start: Date.now() },
      { id: '1002', product: { name: 'Burgers', sku: 'S2', category: 'Cat2' }, status: 'completed', start: Date.now() },
    ]
  }))
}))
vi.mock('../api/pours', () => ({ fetchPoursAnalytics: vi.fn(() => Promise.resolve({ events: [] })) }))

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

describe('OrderList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders KPI cards and table', async () => {
    render(<OrderList onOpen={vi.fn()} />, { wrapper })
    
    expect(await screen.findByText(/Orders Match/i)).toBeDefined()
    expect(screen.getByText('Nuggets')).toBeDefined()
    expect(screen.getByText('Burgers')).toBeDefined()
  })

  it('filters by search text', async () => {
    render(<OrderList onOpen={vi.fn()} />, { wrapper })
    
    await screen.findByText('Nuggets')
    
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'Nuggets' } })
    
    expect(screen.getByText('Nuggets')).toBeDefined()
    expect(screen.queryByText('Burgers')).toBeNull()
  })

  it('toggles status filters', async () => {
    render(<OrderList onOpen={vi.fn()} />, { wrapper })
    
    // Use a very flexible match for the "Running" filter chip
    const runningBtn = await screen.findByText(/Running/i)
    fireEvent.click(runningBtn)
    
    expect(screen.getByText('Nuggets')).toBeDefined()
    expect(screen.queryByText('Burgers')).toBeNull()
  })
})
