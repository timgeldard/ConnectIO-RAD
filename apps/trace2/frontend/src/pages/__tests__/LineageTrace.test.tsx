import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageBottomUp } from '../BottomUp'
import { PageTopDown } from '../TopDown'
import React from 'react'

// Mock context and hooks
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { material_id: 'M1', batch_id: 'B1', days_to_expiry: 100, shelf_life_status: 'OK', batch_status: 'RELEASED', uom: 'KG' },
      lineage: [
        { id: 'N1', level: 1, material_id: 'RM1', material: 'Raw Mat 1', batch: 'RB1', qty: 500, uom: 'KG', link: 'CONSUMED' }
      ]
    }
  }))
}))

// Mock components
vi.mock('../../components/LineageGraph', () => ({
  LineageGraph: () => <div data-testid="mock-graph" />,
  NodeDetailPanel: () => <div data-testid="mock-panel" />
}))

describe('Lineage Trace Pages', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders BottomUp page correctly', () => {
    render(<PageBottomUp batch={mockBatch} navigate={vi.fn()} />)
    expect(screen.getByText(/What went into this batch/i)).toBeInTheDocument()
    expect(screen.getByText('Direct inputs')).toBeInTheDocument()
    expect(screen.getByTestId('mock-graph')).toBeInTheDocument()
  })

  it('renders TopDown page correctly', () => {
    render(<PageTopDown batch={mockBatch} navigate={vi.fn()} />)
    expect(screen.getByText(/Where did this batch go/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-graph')).toBeInTheDocument()
  })
})
