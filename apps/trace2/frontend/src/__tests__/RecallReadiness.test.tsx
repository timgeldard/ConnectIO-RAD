import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PageRecallReadiness } from '../pages/RecallReadiness'
import { I18nProvider } from '@connectio/shared-frontend-i18n'

// Mock useBatchData
vi.mock('../data/useBatchData', () => ({
  useBatchData: vi.fn((fetcher, mat, batch) => ({
    loading: false,
    error: null,
    data: {
      batch: { material_id: mat, batch_id: batch, batch_status: 'Released', manufacture_date: '2024-01-01', expiry_date: '2025-01-01', unrestricted: 1000, blocked: 0, qi: 0, customers_affected: 5, countries_affected: 2, total_shipped_kg: 500, total_deliveries: 10, total_consumed: 0, consuming_pos: 0, uom: 'KG' },
      countries: [{ name: 'Ireland', qty: 300, share: 0.6 }, { name: 'UK', qty: 200, share: 0.4 }],
      customers: [{ name: 'Customer A', qty: 250, share: 0.5 }, { name: 'Customer B', qty: 250, share: 0.5 }],
      deliveries: [{ delivery: 'D1', customer: 'Customer A', status: 'COMPLETED', date: '2024-02-01', qty: 100 }],
      exposure: [{ material: 'M1', batch: 'B2', plant: 'P1', qty: 100, stock: 50, shipped: 50, path_depth: 1, status: 'Released', risk: 'HIGH' }],
      events: [{ date: '2024-01-01', category: 'PRODUCTION', type: 'Order', qty: 1000 }]
    }
  }))
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider appName="trace2" resources={{ en: {} }} loadResource={async () => ({})}>
    {children}
  </I18nProvider>
)

describe('PageRecallReadiness', () => {
  const mockBatch = { material_id: 'MAT1', batch_id: 'BAT1' } as any

  it('renders recall metrics and tables', async () => {
    render(<PageRecallReadiness batch={mockBatch} navigate={vi.fn()} />, { wrapper })
    
    expect(screen.getByText(/ISSUE READINESS/i)).toBeDefined()
    expect(screen.getByText('5')).toBeDefined() // customersAffected
    expect(screen.getByText('2')).toBeDefined() // countriesAffected
  })

  it('toggles simulation mode', () => {
    const onSim = vi.fn()
    render(<PageRecallReadiness batch={mockBatch} navigate={vi.fn()} sim={false} onSim={onSim} />, { wrapper })
    
    const simBtn = screen.getByText(/Simulate Recall/i)
    fireEvent.click(simBtn)
    
    expect(onSim).toHaveBeenCalledWith(true)
  })

  it('filters risk tiers', async () => {
    render(<PageRecallReadiness batch={mockBatch} navigate={vi.fn()} />, { wrapper })
    
    const highBtn = screen.getByRole('button', { name: 'HIGH' })
    fireEvent.click(highBtn)
    
    // Check if filtered list still shows the high risk batch
    expect(screen.getByText('B2')).toBeDefined()
  })
})
