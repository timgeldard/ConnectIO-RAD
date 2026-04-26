import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageOverview } from '../Overview'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn((fetcher) => {
    if (fetcher.name === 'fetchOverview') {
      return {
        kind: 'ready',
        data: {
          batch: {
            material_id: 'M1',
            batch_id: 'B1',
            material_desc40: 'Test Material',
            plant_id: 'P1',
            plant_name: 'Plant 1',
            manufacture_date: '2024-01-01',
            expiry_date: '2025-01-01',
            days_to_expiry: 365,
            uom: 'KG',
            qty_produced: 1000,
            unrestricted: 500,
            qty_shipped: 200,
            qty_consumed: 100,
            customers_affected: 5,
            countries_affected: 2,
            batch_status: 'UNRESTRICTED',
            total_deliveries: 10,
            total_shipped_kg: 200
          },
          countries: [{ name: 'Ireland', code: 'IE', qty: 100 }],
          customers: [{ name: 'Cust 1', country: 'IE', qty: 100 }],
          deliveries: [{ delivery: 'D1', customer: 'Cust 1', destination: 'Dublin', country: 'IE', date: '2024-01-10', qty: 50, status: 'DELIVERED' }]
        }
      }
    }
    // Mass Balance mock
    return {
      kind: 'ready',
      data: {
        events: [{ date: '2024-01-01', type: 'PROD', qty: 1000, cum: 1000 }]
      }
    }
  })
}))

describe('PageOverview', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders correctly with ready data', () => {
    render(<PageOverview batch={mockBatch} navigate={vi.fn()} />)
    
    expect(screen.getByText(/One batch. Every movement, mass-balance and downstream exposure./i)).toBeInTheDocument()
    expect(screen.getByText(/Qty produced/i)).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument() // Formatted value
    expect(screen.getAllByText('M1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('B1').length).toBeGreaterThan(0)
  })
})
