import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CChart from '../charts/CChart'

// Mock EChart because it doesn't render well in jsdom/vitest
vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('CChart', () => {
  const mockPoints = [
    { batch_id: 'B1', defect_count: 5, batch_date: '2024-01-01T10:00:00Z' },
    { batch_id: 'B2', defect_count: 8, batch_date: '2024-01-02T10:00:00Z' },
    { batch_id: 'B3', defect_count: 3, batch_date: '2024-01-03T10:00:00Z' },
  ]

  it('renders correctly with points', () => {
    render(<CChart points={mockPoints as any} />)
    
    expect(screen.getByText(/C Chart \(Defects per Unit\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
    // Check for some summary statistics in the p tag
    expect(screen.getByText(/c̄ =/i)).toBeInTheDocument()
  })

  it('returns null when no points', () => {
    const { container } = render(<CChart points={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
