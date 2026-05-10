import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GroupedBarChart from '../compare/GroupedBarChart'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />,
}))

describe('GroupedBarChart', () => {
  it('renders comparison data inside the shared chart container', () => {
    render(
      <GroupedBarChart
        materials={[
          {
            material_id: 'M1',
            material_name: 'Material 1',
            scorecard: [{ mic_id: 'MIC1', ppk: 1.5 }],
          },
          {
            material_id: 'M2',
            material_name: 'Material 2',
            scorecard: [{ mic_id: 'MIC1', ppk: 1.1 }],
          },
        ] as any}
        commonMics={[{ mic_id: 'MIC1', mic_name: 'Moisture' }]}
      />,
    )

    expect(screen.getByText('Capability comparison')).toBeTruthy()
    expect(screen.getByText('Ppk by common characteristic across selected materials.')).toBeTruthy()
    expect(screen.getByTestId('mock-echart')).toBeTruthy()
  })

  it('renders the empty state inside the shared chart container', () => {
    render(<GroupedBarChart materials={[]} commonMics={[]} />)

    expect(screen.getByText('Capability comparison')).toBeTruthy()
    expect(screen.getByText('No common characteristics to compare.')).toBeTruthy()
  })
})
