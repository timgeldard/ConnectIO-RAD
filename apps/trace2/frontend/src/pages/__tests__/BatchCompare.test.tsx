import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageBatchCompare } from '../BatchCompare'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { material_id: 'M1', batch_id: 'B1' },
      batches: [
        { batch: 'B1', yield_pct: 105, failed_mics: 0, qty: 1000, accepted: 10, rejected: 0, status: 'RELEASED', po: 'PO1', plant: 'P1', date: '2024-01-01', lot_count: 2 },
        { batch: 'B2', yield_pct: 95, failed_mics: 1, qty: 900, accepted: 9, rejected: 1, status: 'BLOCKED', po: 'PO2', plant: 'P1', date: '2024-01-02', lot_count: 2 }
      ]
    }
  }))
}))

describe('PageBatchCompare', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders batch comparison metrics and tables', () => {
    render(<PageBatchCompare batch={mockBatch} />)
    
    expect(screen.getByText(/How does this batch compare/i)).toBeInTheDocument()
    expect(screen.getByText('100.0')).toBeInTheDocument() // Avg size vs mean: (105+95)/2
    expect(screen.getByText('Pass count')).toBeInTheDocument()
    expect(screen.getByText('Failing batches')).toBeInTheDocument()
    expect(screen.getAllByText('B1').length).toBeGreaterThan(0)
  })
})
