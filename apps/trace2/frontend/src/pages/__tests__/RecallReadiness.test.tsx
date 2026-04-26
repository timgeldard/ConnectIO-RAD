import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageRecallReadiness } from '../RecallReadiness'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: {
        material_id: 'M1',
        batch_id: 'B1',
        batch_status: 'UNRESTRICTED',
        days_to_expiry: 100,
        manufacture_date: '2024-01-01',
        expiry_date: '2024-04-10',
        unrestricted: 1000,
        blocked: 0,
        qi: 0,
        plant_name: 'Seville',
        customers_affected: 5,
        countries_affected: 2,
        total_shipped_kg: 500,
        total_deliveries: 10,
        total_consumed: 100,
        consuming_pos: 2,
        uom: 'KG'
      },
      countries: [{ name: 'Ireland', code: 'IE', qty: 500 }],
      customers: [{ name: 'Cust 1', share: 1, qty: 500 }],
      deliveries: [],
      exposure: [{ material: 'FG1', batch: 'FB1', stock: 100, shipped: 400, risk: 'CRITICAL', status: 'SHIPPED', path_depth: 1 }],
      events: []
    }
  }))
}))

describe('PageRecallReadiness', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any
  const onSim = vi.fn()

  it('renders summary KPIs and charts', () => {
    render(<PageRecallReadiness batch={mockBatch} navigate={vi.fn()} onSim={onSim} sim={false} />)
    
    expect(screen.getByText(/If this batch were recalled today/i)).toBeInTheDocument()
    expect(screen.getByText('500.0')).toBeInTheDocument() // total shipped
    expect(screen.getAllByText(/Unrestricted/i).length).toBeGreaterThan(0)
  })

  it('calls onSim when Simulate recall is clicked', () => {
    render(<PageRecallReadiness batch={mockBatch} navigate={vi.fn()} onSim={onSim} sim={false} />)
    
    fireEvent.click(screen.getByText(/Simulate recall/i))
    expect(onSim).toHaveBeenCalledWith(true)
  })
})
