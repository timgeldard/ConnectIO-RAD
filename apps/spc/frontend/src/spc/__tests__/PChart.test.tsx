import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PChart from '../charts/PChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('PChart', () => {
  const mockSpc = {
    p: { pBar: 0.1, ucl: 0.2, lcl: 0, points: [
      { batch_id: 'B1', n_inspected: 100, n_nonconforming: 10, p_value: 0.1 },
      { batch_id: 'B2', n_inspected: 100, n_nonconforming: 5, p_value: 0.05 }
    ] }
  }

  it('renders PChart', () => {
    render(<PChart spc={mockSpc as any} points={mockSpc.p.points as any} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
