import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageProductionHistory } from '../ProductionHistory'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { material_id: 'M1', material_name: 'Test Mat', batch_id: 'B1' },
      batches: [
        { batch: 'B1', qty: 1000, status: 'RELEASED', date: '2024-01-01' },
        { batch: 'B2', qty: 1200, status: 'BLOCKED', date: '2024-01-02' }
      ]
    }
  }))
}))

describe('PageProductionHistory', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders production history details and charts', () => {
    render(<PageProductionHistory batch={mockBatch} />)
    
    expect(screen.getByText(/All batches of this material/i)).toBeInTheDocument()
    expect(screen.getByText(/Total batches/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Total batches count
    expect(screen.getByText(/Avg batch size/i)).toBeInTheDocument()
    expect(screen.getByText('1,100')).toBeInTheDocument() // (1000+1200)/2
  })
})
