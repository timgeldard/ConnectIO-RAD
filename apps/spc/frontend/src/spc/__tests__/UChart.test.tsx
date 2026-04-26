import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import UChart from '../charts/UChart'
import React from 'react'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('UChart', () => {
  const mockPoints = [
    { batch_id: 'B1', defect_count: 5, n_units: 10, value: 0.5 },
    { batch_id: 'B2', defect_count: 3, n_units: 10, value: 0.3 }
  ]

  it('renders UChart', () => {
    const mockSpc = {
      u: { uBar: 0.4, ucl: 0.8, lcl: 0, points: mockPoints }
    }
    render(<UChart spc={mockSpc as any} points={mockPoints as any} />)
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
