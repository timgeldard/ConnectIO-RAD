import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deltaPct, mapTone } from '../pages/analyticsShared'
import { YieldAnalyticsPage } from '../pages/YieldAnalytics'
import { QualityAnalyticsPage } from '../pages/QualityAnalytics'
import { PourAnalyticsPage } from '../pages/PourAnalytics'
import type { YieldData } from '../api/yield'
import type { QualityData } from '../api/quality'
import type { PoursData } from '../api/pours'

// ── API mocks ─────────────────────────────────────────────────────────────────

const { fetchYieldMock, fetchQualityMock, fetchPoursMock } = vi.hoisted(() => ({
  fetchYieldMock: vi.fn(),
  fetchQualityMock: vi.fn(),
  fetchPoursMock: vi.fn(),
}))

vi.mock('../api/yield', () => ({ fetchYieldAnalytics: fetchYieldMock }))
vi.mock('../api/quality', () => ({ fetchQualityAnalytics: fetchQualityMock }))
vi.mock('../api/pours', () => ({ fetchPoursAnalytics: fetchPoursMock }))

// ── Mock heavy chart/panel internals so jsdom does not fail on canvas ─────────

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn(),
  })),
  registerTheme: vi.fn(),
  use: vi.fn(),
}))

// ── Helper unit tests ─────────────────────────────────────────────────────────

describe('deltaPct', () => {
  it('returns empty when either value is null', () => {
    expect(deltaPct(null, 100)).toEqual({})
    expect(deltaPct(100, null)).toEqual({})
  })

  it('returns empty when prior is zero', () => {
    expect(deltaPct(50, 0)).toEqual({})
  })

  it('formats a positive delta with + prefix', () => {
    const r = deltaPct(110, 100)
    expect(r.delta).toBe('+10.0%')
    expect(r.trend).toBe('up')
  })

  it('formats a negative delta', () => {
    const r = deltaPct(90, 100)
    expect(r.delta).toBe('-10.0%')
    expect(r.trend).toBe('down')
  })
})

describe('mapTone', () => {
  it('maps good → ok, ok → warn, bad → risk, unknown → neutral', () => {
    expect(mapTone('good')).toBe('ok')
    expect(mapTone('ok')).toBe('warn')
    expect(mapTone('bad')).toBe('risk')
    expect(mapTone('')).toBe('neutral')
    expect(mapTone('other')).toBe('neutral')
  })
})

// ── Yield analytics KPI strip ─────────────────────────────────────────────────

const YIELD_DATA: YieldData = {
  now_ms: 1000000000000,
  target_yield_pct: 90,
  materials: [],
  orders: [
    { process_order_id: 'PO1', material_id: 'M1', material_name: 'Mat A', plant_id: 'P1',
      qty_received_kg: 1000, qty_issued_kg: 920, yield_pct: 92, loss_kg: 80, order_date_ms: 999999990000 },
  ],
  prior7d: [],
  daily30d: [],
  hourly24h: [],
}

describe('YieldAnalyticsPage KPI strip', () => {
  beforeEach(() => { fetchYieldMock.mockResolvedValue(YIELD_DATA) })

  it('renders all three KPI labels via KpiCardWidget', async () => {
    render(<YieldAnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Target yield')).toBeInTheDocument())
    expect(screen.getByText('Average yield')).toBeInTheDocument()
    expect(screen.getByText('Total loss')).toBeInTheDocument()
  })

  it('passes target yield value through KpiCardWidget', async () => {
    render(<YieldAnalyticsPage />)
    await waitFor(() => expect(screen.getAllByText('90%').length).toBeGreaterThan(0))
  })
})

// ── Quality analytics KPI strip ───────────────────────────────────────────────

const QUALITY_DATA: QualityData = {
  now_ms: 1000000000000,
  materials: [],
  rows: [
    { process_order: 'PO1', inspection_lot_id: null, material_id: 'M1', material_name: 'Mat A',
      plant_id: 'P1', characteristic_id: 'C1', characteristic_description: 'Desc',
      sample_id: null, specification: null, quantitative_result: null, qualitative_result: null,
      uom: null, judgement: 'A', result_date_ms: 999999990000, usage_decision_code: null,
      valuation_code: null, quality_score: null },
    { process_order: 'PO1', inspection_lot_id: null, material_id: 'M1', material_name: 'Mat A',
      plant_id: 'P1', characteristic_id: 'C1', characteristic_description: 'Desc',
      sample_id: null, specification: null, quantitative_result: null, qualitative_result: null,
      uom: null, judgement: 'A', result_date_ms: 999999990000, usage_decision_code: null,
      valuation_code: null, quality_score: null },
  ],
  prior7d: [],
  daily30d: [],
  hourly24h: [],
}

describe('QualityAnalyticsPage KPI strip', () => {
  beforeEach(() => { fetchQualityMock.mockResolvedValue(QUALITY_DATA) })

  it('renders all three KPI labels via KpiCardWidget', async () => {
    render(<QualityAnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Accepted results')).toBeInTheDocument())
    expect(screen.getByText('Right first time')).toBeInTheDocument()
    expect(screen.getByText('Rejected results')).toBeInTheDocument()
  })

  it('passes accepted count through KpiCardWidget', async () => {
    render(<QualityAnalyticsPage />)
    await waitFor(() => expect(screen.getAllByText('2').length).toBeGreaterThan(0))
  })
})

// ── Pour analytics page KPI strip ─────────────────────────────────────────────

const POURS_DATA: PoursData = {
  now_ms: 1000000000000,
  planned_24h: 300,
  lines: ['L01'],
  events: Array.from({ length: 320 }, (_, i) => ({
    ts_ms: 1000000000000 - i * 60000,
    line_id: 'L01', operator: null, source_area: null, source_type: null,
    process_order: null, material_name: null, quantity: 1, uom: 'KG', shift: null,
  })),
  prior7d: [],
  daily30d: { ALL: [] },
  hourly24h: { ALL: [] },
}

describe('PourAnalyticsPage KPI strip', () => {
  beforeEach(() => { fetchPoursMock.mockResolvedValue(POURS_DATA) })

  it('renders all three KPI labels via KpiCardWidget', async () => {
    render(<PourAnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Target')).toBeInTheDocument())
    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
  })
})
