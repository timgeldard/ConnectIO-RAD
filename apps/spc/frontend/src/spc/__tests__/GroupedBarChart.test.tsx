/**
 * Unit tests for GroupedBarChart.
 * Verifies that the shared ChartContainer wrapper renders correctly for both
 * the populated chart state and the empty (no common characteristics) state.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GroupedBarChart from '../compare/GroupedBarChart'
import type { CompareScorecardMaterial } from '../types'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />,
}))

const twoMaterials: CompareScorecardMaterial[] = [
  {
    material_id: 'M1',
    material_name: 'Material 1',
    scorecard: [{ mic_id: 'MIC1', mic_name: 'Moisture', batch_count: 10, ppk: 1.5 }],
  },
  {
    material_id: 'M2',
    material_name: 'Material 2',
    scorecard: [{ mic_id: 'MIC1', mic_name: 'Moisture', batch_count: 8, ppk: 1.1 }],
  },
]

describe('GroupedBarChart', () => {
  /** Populated state: EChart renders inside the shared container. */
  it('renders comparison data inside the shared chart container', () => {
    render(
      <GroupedBarChart
        materials={twoMaterials}
        commonMics={[{ mic_id: 'MIC1', mic_name: 'Moisture' }]}
      />,
    )

    expect(screen.getByText('Capability comparison')).toBeTruthy()
    expect(screen.getByText('Ppk by common characteristic across selected materials.')).toBeTruthy()
    expect(screen.getByTestId('mock-echart')).toBeTruthy()
  })

  /** Empty state: placeholder message renders inside the shared container. */
  it('renders the empty state inside the shared chart container', () => {
    render(<GroupedBarChart materials={[]} commonMics={[]} />)

    expect(screen.getByText('Capability comparison')).toBeTruthy()
    expect(screen.getByText('No common characteristics to compare.')).toBeTruthy()
  })
})
