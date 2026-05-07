import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ControlTower } from '../ControlTower'

const { useApiMock } = vi.hoisted(() => ({
  useApiMock: vi.fn(),
}))

vi.mock('../../hooks/useApi', () => ({
  useApi: useApiMock,
}))

describe('ControlTower', () => {
  beforeEach(() => {
    useApiMock.mockReset()
    useApiMock.mockImplementation((path: string) => {
      if (path === '/api/kpis') {
        return { data: { kpis: { orders_red: 2, orders_amber: 3, tos_open: 45, deliveries_at_risk: 1, inbound_open: 18671, bin_util_pct: 55.9 } }, loading: false, error: null }
      }
      return { data: null, loading: false, error: null }
    })
  })

  it('renders title and risk cards', () => {
    render(<ControlTower />)
    expect(screen.getByText(/Warehouse control tower/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Orders at risk/i).length).toBeGreaterThan(0)
  })

  it('shows KPI unavailability instead of a healthy empty signal state', () => {
    useApiMock.mockImplementation((path: string) => {
      if (path === '/api/kpis') return { data: null, loading: false, error: '503 Service Unavailable' }
      return { data: null, loading: false, error: null }
    })

    render(<ControlTower />)

    expect(screen.getByText('Live warehouse KPIs unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Unable to determine live critical KPI signals/i)).toBeInTheDocument()
    expect(screen.queryByText('No live critical KPI signals for this plant.')).not.toBeInTheDocument()
  })
})
