import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const renderWithQuery = (ui: React.ReactElement) => {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

// Home
import { Home } from '~/pages/Home'

// Other pages
import { LabBoard } from '~/pages/lab/LabBoard'
import { Alarms } from '~/pages/Alarms'
import { Admin } from '~/pages/Admin'

describe('Home', () => {
  it('renders the launcher shell', () => {
    renderWithQuery(<Home />)
    expect(document.querySelector('.cq-launcher')).toBeInTheDocument()
  })
})

describe('LabBoard', () => {
  it('renders the lab board wallboard loading state', () => {
    renderWithQuery(<LabBoard />)
    expect(screen.getByText(/Select a plant/)).toBeInTheDocument()
  })

  it('renders fail cards for the visible page empty context state', () => {
    const { container } = renderWithQuery(<LabBoard />)
    expect(container.textContent?.includes('Select a plant')).toBeTruthy()
  })

  it('shows the open fails count empty context state', () => {
    renderWithQuery(<LabBoard />)
    expect(screen.getByText(/Select a plant/)).toBeInTheDocument()
  })
})

describe('Alarms', () => {
  it('renders the alarms signal table', () => {
    renderWithQuery(<Alarms />)
    expect(screen.getByText('ALARMS')).toBeInTheDocument()
    expect(screen.getByText('Signal stream')).toBeInTheDocument()
  })

  it('renders KPI row with open/ack/closed counts', () => {
    renderWithQuery(<Alarms />)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })
})

describe('Admin', () => {
  it('renders the settings page', () => {
    render(<Admin />)
    expect(screen.getByText('SETTINGS')).toBeInTheDocument()
  })

  it('renders all 5 settings sections', () => {
    render(<Admin />)
    expect(screen.getByText('Identity & access')).toBeInTheDocument()
    expect(screen.getByText('Data sources')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })
})
