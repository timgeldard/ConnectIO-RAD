import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from '../FilterBar'

vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { plantId: 'P1' },
    activeFloor: 'F1',
    timeWindow: 30,
    setTimeWindow: vi.fn(),
    heatmapMode: 'deterministic',
    setHeatmapMode: vi.fn(),
    historicalDate: null,
    setHistoricalDate: vi.fn(),
    decayLambda: 0.5,
    setDecayLambda: vi.fn(),
    selectedMics: [],
    setSelectedMics: vi.fn(),
  })
}))

vi.mock('~/api/client', () => ({
  useMics: () => ({ data: ['MIC1', 'MIC2'] }),
  useHeatmap: () => ({ data: { markers: [] } }),
}))

describe('FilterBar', () => {
  it('renders time window options and heatmap mode buttons', () => {
    render(<FilterBar />)
    // Time window options: mock t('envmon.filterBar.days', { n: 30 }) returns 'envmon.filterBar.days'
    // (key has no {{n}} in it, so all options have the same key text)
    expect(screen.getAllByText('envmon.filterBar.days').length).toBeGreaterThan(0)
    // Heatmap mode buttons
    expect(screen.getByText('envmon.filterBar.deterministic')).toBeInTheDocument()
    expect(screen.getByText('envmon.filterBar.continuous')).toBeInTheDocument()
  })

  it('renders time travel controls', () => {
    render(<FilterBar />)
    expect(screen.getByText('envmon.filterBar.timeTravel')).toBeInTheDocument()
    // Today label: sliderValue is 0, so 'envmon.filterBar.today'
    expect(screen.getByText('envmon.filterBar.today')).toBeInTheDocument()
  })
})
