import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'

// Mock window.scrollTo
window.scrollTo = vi.fn()

// Mock sub-pages
vi.mock('../pages/OrderList', () => ({
  OrderList: ({ onOpen }: any) => (
    <div>
      <div data-testid="page-list">Order List</div>
      <button onClick={() => onOpen({ id: '1001' })}>Open Detail</button>
    </div>
  )
}))
vi.mock('../pages/OrderDetail', () => ({
  OrderDetail: ({ onBack }: any) => (
    <div>
      <div data-testid="page-detail">Order Detail</div>
      <button onClick={onBack}>Back</button>
    </div>
  )
}))
vi.mock('../pages/PlanningBoard', () => ({ PlanningBoard: () => <div data-testid="page-planning">Planning</div> }))
vi.mock('../pages/PourAnalytics', () => ({ PourAnalyticsPage: () => <div data-testid="page-pours">Pours</div> }))

// Mock API calls
vi.mock('../api/me', () => ({ fetchCurrentUser: vi.fn(() => Promise.resolve({ name: 'Test', initials: 'T' })) }))
vi.mock('../api/preferences', () => ({
  fetchPreferences: vi.fn(() => Promise.resolve({ pinnedModules: [] })),
  savePreferences: vi.fn(() => Promise.resolve())
}))

describe('POH App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Order List by default', () => {
    render(<App />)
    expect(screen.getByTestId('page-list')).toBeDefined()
  })

  it('navigates to detail when onOpen is called', async () => {
    render(<App />)
    const btn = screen.getByText('Open Detail')
    fireEvent.click(btn)
    expect(await screen.findByTestId('page-detail')).toBeDefined()
  })

  it('switches views via sidebar', () => {
    render(<App />)
    
    // Find sidebar button for Planning (renders PLAN shortName)
    const planningBtn = screen.getByText('PLAN', { selector: 'button span' })
    fireEvent.click(planningBtn)
    
    expect(screen.getByTestId('page-planning')).toBeDefined()
  })
})
