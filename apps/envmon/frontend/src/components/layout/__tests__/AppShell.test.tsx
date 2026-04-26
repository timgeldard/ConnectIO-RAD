import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppShell from '../AppShell'

// Mock context and hooks
vi.mock('~/context/EMContext', () => ({
  useEM: () => ({
    view: { level: 'global', plantId: null, floorId: null },
    setView: vi.fn(),
    personaId: 'regional',
    setPersonaId: vi.fn(),
    adminMode: false,
    setAdminMode: vi.fn(),
  })
}))

vi.mock('~/api/client', () => ({
  usePlants: () => ({ data: [{ plant_id: 'P1', plant_name: 'Plant 1', plant_code: 'P225' }] })
}))

// Mock sub-views
vi.mock('~/views/GlobalView', () => ({ default: () => <div data-testid="global-view" /> }))
vi.mock('~/views/SiteView', () => ({ default: () => <div data-testid="site-view" /> }))
vi.mock('~/views/FloorView', () => ({ default: () => <div data-testid="floor-view" /> }))
vi.mock('~/components/admin/CoordinateMapper', () => ({ default: () => <div data-testid="admin-view" /> }))
vi.mock('~/components/ui/PersonaSwitcher', () => ({ default: () => <div data-testid="persona-switcher" /> }))

describe('AppShell', () => {
  it('renders GlobalView when level is global', () => {
    render(<AppShell />)
    expect(screen.getByTestId('global-view')).toBeInTheDocument()
    // Nav label uses i18n — mock t() returns the key string
    expect(screen.getByText('envmon.nav.portfolio')).toBeInTheDocument()
  })
})
