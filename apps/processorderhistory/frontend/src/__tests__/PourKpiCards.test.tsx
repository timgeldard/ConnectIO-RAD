import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PourKpiCards } from '../pages/PourAnalytics'
import type { PoursData } from '../api/pours'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

vi.mock('../api/pours', () => ({
  fetchPoursAnalytics: fetchMock,
}))

const MOCK_DATA: PoursData = {
  now_ms: 1000000000000,
  planned_24h: 320,
  lines: ['L01'],
  events: Array.from({ length: 280 }, (_, i) => ({
    ts_ms: 1000000000000 - i * 60000,
    line_id: 'L01',
    operator: null,
    source_area: null,
    source_type: null,
    process_order: null,
    material_name: null,
    quantity: 1,
    uom: 'KG',
    shift: null,
  })),
  prior7d: [],
  daily30d: { ALL: [] },
  hourly24h: { ALL: [] },
}

describe('PourKpiCards', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(MOCK_DATA)
  })

  it('renders all three KPI labels via KpiCardWidget', async () => {
    render(<PourKpiCards lineFilter="ALL" />)
    await waitFor(() => expect(screen.getByText('Target / 24h')).toBeInTheDocument())
    expect(screen.getByText('Planned / 24h')).toBeInTheDocument()
    expect(screen.getByText('Actual / 24h')).toBeInTheDocument()
  })

  it('passes KPI values through KpiCardWidget props', async () => {
    render(<PourKpiCards lineFilter="ALL" />)
    await waitFor(() => expect(screen.getByText('350')).toBeInTheDocument())
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText('280')).toBeInTheDocument()
  })
})
