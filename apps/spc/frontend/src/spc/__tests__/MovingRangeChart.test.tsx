import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MovingRangeChart from '../charts/MovingRangeChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('MovingRangeChart', () => {
  const mockSpc = {
    imr: { 
      mrBar: 2, 
      ucl_mr: 4, 
      lcl_mr: 0, 
      movingRanges: [1]
    }
  }
  const mockIndexedPoints = [
    { batch_id: 'B0', value: 10, originalIndex: 0 },
    { batch_id: 'B1', value: 11, originalIndex: 1 }
  ]

  it('renders MovingRangeChart', () => {
    render(<MovingRangeChart spc={mockSpc as any} indexedPoints={mockIndexedPoints as any} mrSignals={[]} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
