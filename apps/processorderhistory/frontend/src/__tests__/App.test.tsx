import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import App from '../App'

const orderDetailSpy = vi.fn()
window.scrollTo = vi.fn()

// Stub heavy/randomized pages so the smoke test focuses on App wiring.
vi.mock('../pages/OrderDetail', () => ({
  OrderDetail: (props: any) => {
    orderDetailSpy(props)
    return <div data-testid="page-detail" />
  },
}))
vi.mock('../pages/PlanningBoard', () => ({ PlanningBoard: () => <div data-testid="page-planning" /> }))
vi.mock('../pages/PourAnalytics', () => ({
  PourAnalyticsPage: () => <div data-testid="page-pours" />,
  PourLineFilter: () => <div data-testid="line-filter" />,
  PourKpiCards: () => <div data-testid="pour-kpis" />,
}))
vi.mock('../pages/OrderList', () => ({
  OrderList: () => <div data-testid="page-list">order list</div>,
}))
vi.mock('../api/me', () => ({
  fetchCurrentUser: vi.fn(() => new Promise(() => {})),
}))
vi.mock('../api/preferences', () => ({
  fetchPreferences: vi.fn(() => new Promise(() => {})),
  savePreferences: vi.fn(() => Promise.resolve()),
}))

describe('App', () => {
  beforeEach(() => {
    orderDetailSpy.mockClear()
  })

  it('renders the order list view by default with the sidebar', () => {
    render(<App />)
    expect(screen.getByTestId('page-list')).toBeInTheDocument()
    expect(screen.getByTitle('Process Orders')).toBeInTheDocument()
  })

  it('passes only an order reference for cross-app process-order navigation', () => {
    render(<App />)

    act(() => {
      ;(window as any).__navigateToOrder('1001234', {
        materialId: 'MAT-SHOULD-NOT-BE-COPIED',
        plantId: 'PLANT-SHOULD-NOT-BE-COPIED',
        label: 'Synthetic material',
        _from: 'quality',
      })
    })

    expect(screen.getByTestId('page-detail')).toBeInTheDocument()
    const props = orderDetailSpy.mock.calls.at(-1)?.[0]
    expect(props.order).toEqual({
      id: '1001234',
      processOrderId: '1001234',
      status: 'unknown',
    })
    expect(props.from).toBe('quality')
  })
})
