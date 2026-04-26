import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SigmaChart from '../charts/SigmaChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('SigmaChart', () => {
  const mockSpc = {
    xbarS: { 
      sBar: 1, 
      ucl_s: 2, 
      lcl_s: 0, 
      subgroupStats: [{ batchId: 'B1', stddev: 0.5, xbar: 10, n: 5 }] 
    }
  }

  it('renders SigmaChart', () => {
    render(<SigmaChart spc={mockSpc as any} mrSignals={[]} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
