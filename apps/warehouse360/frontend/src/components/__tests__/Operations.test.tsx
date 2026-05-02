import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Inbound } from '../Inbound'
import { Outbound } from '../Outbound'
import { Inventory } from '../Inventory'
import { Exceptions, Performance } from '../ExceptionsPerf'
import { ProductionStaging } from '../ProductionStaging'
import { Dispensary } from '../Dispensary'
import { Sidebar, TopBar } from '../Shell'
import { OrderStagingDetail } from '../OrderDetail'
import { DocsPage } from '../Docs'

vi.mock('../../hooks/useApi', () => ({
  useApi: () => ({ data: null, loading: false, error: null }),
}))

describe('Warehouse Operations Pages', () => {
  it('renders Inbound page and KPIs', () => {
    render(<Inbound />)
    expect(screen.getByText('Inbound')).toBeInTheDocument()
    expect(screen.getByText('Open PO lines')).toBeInTheDocument()
  })

  it('renders Outbound page and KPIs', () => {
    render(<Outbound />)
    expect(screen.getByText('Outbound')).toBeInTheDocument()
    expect(screen.getByText('At cut-off risk')).toBeInTheDocument()
  })

  it('renders Inventory page and KPIs', () => {
    render(<Inventory />)
    expect(screen.getByText('Inventory & Bins')).toBeInTheDocument()
    expect(screen.getByText('Bin utilisation')).toBeInTheDocument()
  })

  it('renders Exceptions page', () => {
    render(<Exceptions />)
    expect(screen.getByText('Exceptions')).toBeInTheDocument()
    expect(screen.getByText('Critical open')).toBeInTheDocument()
  })

  it('renders Performance page', () => {
    render(<Performance />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByText('Staging SLA')).toBeInTheDocument()
  })

  it('renders ProductionStaging page', () => {
    render(<ProductionStaging />)
    expect(screen.getAllByText('Production Staging').length).toBeGreaterThan(0)
    expect(screen.getByText(/Orders at risk/i)).toBeInTheDocument()
  })

  it('renders Dispensary page', () => {
    render(<Dispensary />)
    expect(screen.getByText('Dispensary')).toBeInTheDocument()
  })

  it('renders Sidebar', () => {
    render(<Sidebar shift={{ id: 'Shift B' }} />)
    expect(screen.getByText(/Warehouse 360/i)).toBeInTheDocument()
  })

  it('renders TopBar', () => {
    render(<TopBar title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Plant')).toBeInTheDocument()
  })

  it('renders OrderStagingDetail', () => {
    const mockOrder = { id: 'PO1', product: 'Test', material: { id: 'M1', name: 'Mat' }, vendor: { name: 'V' }, line: { name: 'L1', area: 'A' }, method: { label: 'Std' }, shift: { label: 'B', hours: '8' }, pallets: 10, palletsStaged: 5, bomCount: 5, bomPicked: 2, start: new Date(), status: 'Staging' }
    render(<OrderStagingDetail order={mockOrder} />)
    expect(screen.getByText('Order context')).toBeInTheDocument()
  })

  it('renders DocsPage', () => {
    render(<DocsPage />)
    expect(screen.getByText(/One pane of glass for the people who run the warehouse floor/i)).toBeInTheDocument()
  })
})
