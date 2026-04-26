import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageQuality } from '../Quality'
import React from 'react'

// Mock useBatchData hook
vi.mock('../../data/useBatchData', () => ({
  useBatchData: vi.fn(() => ({
    kind: 'ready',
    data: {
      batch: { material_id: 'M1', batch_id: 'B1', batch_status: 'UNRESTRICTED' },
      lots: [
        { lot: 'L1', type: '01', decision: 'ACCEPTED', start: '2024-01-01', end: '2024-01-02', origin: 'SAP', insp_by: 'User' },
        { lot: 'L2', type: '01', decision: 'REJECTED', start: '2024-01-03', end: '2024-01-04', origin: 'SAP', insp_by: 'User' }
      ],
      results: [
        { lot: 'L1', id: 'MIC1', name: 'Char 1', value: '10', result: 'ACCEPTED' },
        { lot: 'L2', id: 'MIC2', name: 'Char 2', value: '20', result: 'REJECTED' }
      ],
      summary: { lot_count: 2, accepted_result_count: 1, rejected_result_count: 1, failed_mic_count: 1, latest_inspection_date: '2024-01-04' }
    }
  }))
}))

describe('PageQuality', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders quality summary and filtered results', () => {
    render(<PageQuality batch={mockBatch} />)
    
    expect(screen.getByText(/Inspection lots and characteristic results/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // lot count
    
    // By default L1 is selected
    expect(screen.getAllByText('Char 1').length).toBeGreaterThan(0)
    
    // Switch to L2
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'L2' } })
    expect(screen.getAllByText('Char 2').length).toBeGreaterThan(0)
  })
})
