import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageCoA } from '../CoA'
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
        material_name: 'Test Material',
        plant_id: 'P1',
        plant_name: 'Seville',
        manufacture_date: '2024-01-01',
        expiry_date: '2025-01-01',
        uom: 'KG',
        process_order: 'PO1'
      },
      mics: [
        { id: 'MIC1', name: 'Char 1', target: '10', value: '9.5', result: 'ACCEPTED', uom: 'KG' }
      ]
    }
  }))
}))

describe('PageCoA', () => {
  const mockBatch = { material_id: 'M1', batch_id: 'B1' } as any

  it('renders certificate of analysis details', () => {
    render(<PageCoA batch={mockBatch} />)
    
    expect(screen.getAllByText(/Certificate of Analysis/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Test Material')).toBeInTheDocument()
    expect(screen.getAllByText(/Accepted/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Accepted — released for unrestricted use/i)).toBeInTheDocument()
  })
})
