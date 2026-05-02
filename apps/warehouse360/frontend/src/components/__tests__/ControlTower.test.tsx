import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ControlTower } from '../ControlTower'

vi.mock('../../hooks/useApi', () => ({
  useApi: () => ({ data: { kpis: { orders_red: 2, orders_amber: 3, tos_open: 45, deliveries_at_risk: 1, inbound_open: 18671, bin_util_pct: 55.9 } }, loading: false, error: null }),
}))

describe('ControlTower', () => {
  it('renders greeting and title', () => {
    render(<ControlTower />)
    expect(screen.getByText(/Good morning, Niamh/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Orders at risk/i).length).toBeGreaterThan(0)
  })
})
