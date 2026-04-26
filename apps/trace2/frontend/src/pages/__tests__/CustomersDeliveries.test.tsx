import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageCustomersDeliveries } from '../CustomersDeliveries'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { material_id: 'M1', batch_id: 'B1', customers_affected: 2, countries_affected: 1, total_shipped_kg: 1000, total_deliveries: 5, uom: 'KG' },
      customers: [
        { id: 'C1', name: 'Cust 1', country: 'US', qty: 600, share: 60, deliveries: 3 },
        { id: 'C2', name: 'Cust 2', country: 'IE', qty: 400, share: 40, deliveries: 2 }
      ],
      deliveries: [
        { delivery: 'D1', customer: 'Cust 1', destination: 'New York', country: 'US', date: '2024-01-01', qty: 200, status: 'DELIVERED' }
      ],
      countries: [{ name: 'USA', code: 'US', qty: 600 }]
    }
  }))
}))

describe('PageCustomersDeliveries', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders customers tab by default and switches to deliveries', () => {
    render(<PageCustomersDeliveries batch={mockBatch} navigate={vi.fn()} />)
    
    expect(screen.getByText(/Where did this batch go/i)).toBeInTheDocument()
    expect(screen.getAllByText('Cust 1').length).toBeGreaterThan(0)
    
    // Switch to deliveries
    fireEvent.click(screen.getByRole('button', { name: /Deliveries \(1\)/i }))
    expect(screen.getByText('New York')).toBeInTheDocument()
  })
})
