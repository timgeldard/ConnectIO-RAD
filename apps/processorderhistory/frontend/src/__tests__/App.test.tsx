import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'

// Stub heavy/randomized pages so the smoke test focuses on App wiring.
vi.mock('../pages/OrderDetail', () => ({ OrderDetail: () => <div data-testid="page-detail" /> }))
vi.mock('../pages/PlanningBoard', () => ({ PlanningBoard: () => <div data-testid="page-planning" /> }))
vi.mock('../pages/PourAnalytics', () => ({
  PourAnalyticsPage: () => <div data-testid="page-pours" />,
  PourLineFilter: () => <div data-testid="line-filter" />,
  PourKpiCards: () => <div data-testid="pour-kpis" />,
}))
vi.mock('../pages/OrderList', () => ({
  OrderList: () => <div data-testid="page-list">order list</div>,
}))

describe('App', () => {
  it('renders the order list view by default with the sidebar', () => {
    render(<App />)
    expect(screen.getByTestId('page-list')).toBeInTheDocument()
    // Sidebar brand is the localized "OPERATIONS" headline; uppercased in JSX.
    expect(screen.getByText('OPERATIONS')).toBeInTheDocument()
  })
})
