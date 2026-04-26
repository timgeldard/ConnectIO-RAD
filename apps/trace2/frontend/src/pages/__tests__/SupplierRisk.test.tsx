import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageSupplierRisk } from '../SupplierRisk'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      suppliers: [
        { id: 'V1', name: 'Supp 1', country: 'US', material: 'Mat A', received: 5000, batches: 10, first: '2023-01-01', last: '2024-01-01', failure_rate: 0.1, risk: 'HIGH' },
        { id: 'V2', name: 'Supp 2', country: 'DE', material: 'Mat B', received: 3000, batches: 5, first: '2023-05-01', last: '2024-02-01', failure_rate: 0, risk: 'LOW' }
      ]
    }
  }))
}))

describe('PageSupplierRisk', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders supplier risk metrics and charts', () => {
    render(<PageSupplierRisk batch={mockBatch} />)
    
    expect(screen.getByText(/Who supplies inputs that feed this material/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Supplier count
    expect(screen.getByText('8,000')).toBeInTheDocument() // Total received
    expect(screen.getByText('1')).toBeInTheDocument() // High-risk count
    expect(screen.getAllByText('Supp 1').length).toBeGreaterThan(0)
  })
})
