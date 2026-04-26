import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RangeChart from '../charts/RangeChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('RangeChart', () => {
  const mockSpc = {
    xbarR: { 
      rBar: 1, 
      ucl_r: 2, 
      lcl_r: 0, 
      subgroupStats: [{ batchId: 'B1', range: 0.5, xbar: 10, n: 5 }] 
    }
  }

  it('renders RangeChart', () => {
    render(<RangeChart spc={mockSpc as any} mrSignals={[]} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
