import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NPChart from '../charts/NPChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('NPChart', () => {
  const mockSpc = {
    np: { npBar: 10, ucl: 20, lcl: 0, points: [
      { batch_id: 'B1', n_inspected: 100, n_nonconforming: 10, value: 10 },
      { batch_id: 'B2', n_inspected: 100, n_nonconforming: 5, value: 5 }
    ] }
  }

  it('renders NPChart', () => {
    render(<NPChart spc={mockSpc as any} points={mockSpc.np.points as any} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
