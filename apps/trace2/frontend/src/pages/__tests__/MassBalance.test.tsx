import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageMassBalance } from '../MassBalance'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { 
        material_id: 'M1', batch_id: 'B1', uom: 'KG',
        qty_produced: 1000, qty_shipped: 800, qty_consumed: 100, qty_adjusted: 0, current_stock: 100 
      },
      events: [
        { date: '2024-01-01', delta: 1000, cum: 1000, type: 'PROD' },
        { date: '2024-01-02', delta: -800, cum: 200, type: 'SHIP' }
      ]
    }
  }))
}))

describe('PageMassBalance', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders mass balance KPIs and charts', () => {
    render(<PageMassBalance batch={mockBatch} />)
    
    expect(screen.getByText(/Does production reconcile with movements/i)).toBeInTheDocument()
    expect(screen.getByText('0.00')).toBeInTheDocument() // variance
    expect(screen.getByText('Reconciled')).toBeInTheDocument()
    expect(screen.getAllByText('1,000.0').length).toBeGreaterThan(0) // produced
  })
})
