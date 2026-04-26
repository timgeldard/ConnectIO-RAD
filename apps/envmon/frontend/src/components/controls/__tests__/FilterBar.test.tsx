import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from '../FilterBar'
import React from 'react'

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
  it('renders filter options', () => {
    render(<FilterBar />)
    expect(screen.getByText('30 days')).toBeInTheDocument()
    expect(screen.getByText(/deterministic/i)).toBeInTheDocument()
    expect(screen.getByText(/continuous/i)).toBeInTheDocument()
  })
})
