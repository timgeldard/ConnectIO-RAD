/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModuleContentPanel } from '../shell/ModuleContentPanel'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'

vi.mock('../shell/HomePanel', () => ({
  HomePanel: () => <div data-testid="home-panel">Home Panel</div>
}))

describe('ModuleContentPanel', () => {
  const mockModules: ConnectIOModule[] = [
    {
      moduleId: 'spc',
      displayName: 'SPC',
      shortName: 'SPC',
      routeBase: '/spc'
    } as any
  ]

  beforeEach(() => {
    vi.resetAllMocks()
    // Properly mock window.location
    const mockLocation = new URL('http://localhost/')
    vi.stubGlobal('location', {
      ...window.location,
      href: mockLocation.href,
      assign: vi.fn(),
    })
  })

  it('renders HomePanel when moduleId is "home"', () => {
    render(<ModuleContentPanel moduleId="home" modules={mockModules} />)
    expect(screen.getByTestId('home-panel')).toBeDefined()
  })

  it('renders HomePanel when module is not found', () => {
    render(<ModuleContentPanel moduleId="unknown" modules={mockModules} />)
    expect(screen.getByTestId('home-panel')).toBeDefined()
  })

  it('triggers navigation for non-home modules', () => {
    render(<ModuleContentPanel moduleId="spc" modules={mockModules} />)
    expect(window.location.href).toContain('/spc/')
  })

  it('includes activeTabId in navigation', () => {
    render(<ModuleContentPanel moduleId="spc" modules={mockModules} activeTabId="charts" />)
    expect(window.location.href).toContain('tab=charts')
  })
})
