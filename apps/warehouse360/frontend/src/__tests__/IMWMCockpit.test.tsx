import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IMWMCockpit } from '../components/IMWMCockpit'
import { PlantProvider } from '../context/PlantContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock useApi hook
vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn((path) => {
    if (path === '/api/imwm/stock') return { data: { stock: [{ material_id: 'M1', mismatch_kind: 'true', inventory_value_eur: 1000 }] }, loading: false, error: null }
    if (path === '/api/imwm/movements') return { data: { movements: [] }, loading: false, error: null }
    if (path === '/api/imwm/exceptions') return { data: { exceptions: [] }, loading: false, error: null }
    if (path === '/api/imwm/analytics/aging') return { data: { aging: [] }, loading: false, error: null }
    return { data: null, loading: false, error: null }
  })
}))

const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <PlantProvider>
      {children}
    </PlantProvider>
  </QueryClientProvider>
)

describe('IMWMCockpit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders KPI cards and default stock tab', async () => {
    render(<IMWMCockpit />, { wrapper })
    
    expect(screen.getByText('Inventory Cockpit')).toBeDefined()
    expect(screen.getByText('Stock rows')).toBeDefined()
    expect(screen.getByText('True mismatches')).toBeDefined()
    
    // Check for mocked data
    expect(await screen.findAllByText('M1')).toBeDefined()
  })

  it('switches tabs correctly', async () => {
    render(<IMWMCockpit />, { wrapper })
    
    const excTab = screen.getByText('Exceptions')
    fireEvent.click(excTab)
    
    expect(screen.getByText('Exception queue')).toBeDefined()
    
    const movTab = screen.getByText('Movements')
    fireEvent.click(movTab)
    
    expect(screen.getByText('Recent IM movements')).toBeDefined()
  })

  it('filters stock list', async () => {
    render(<IMWMCockpit />, { wrapper })
    
    const trueVarianceBtn = screen.getByText('True variance')
    fireEvent.click(trueVarianceBtn) // Toggle off
    
    // M1 should be gone if it was a true mismatch
    await waitFor(() => {
      expect(screen.queryByText('M1')).toBeNull()
    })
  })
})
