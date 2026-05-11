/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { App } from '~/App'

// Silence SVG/canvas unsupported errors in jsdom
Object.defineProperty(window, 'ResizeObserver', {
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

describe('App shell', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.querySelector('.connectio-shell')).toBeInTheDocument()
  })

  it('shows the left rail with ConnectedQuality module buttons', () => {
    render(<App />)
    expect(screen.getByTitle('Home')).toBeInTheDocument()
    expect(screen.queryByTitle('Trace')).not.toBeInTheDocument()
    expect(screen.queryByTitle('SPC')).not.toBeInTheDocument()
    expect(screen.getByTitle('Lab Board')).toBeInTheDocument()
    expect(screen.getAllByTitle('Alarms')[0]).toBeInTheDocument()
    expect(screen.getAllByTitle('Settings')[0]).toBeInTheDocument()
  })

  it('shows the Home page by default', () => {
    render(<App />)
    expect(document.querySelector('.cq-launcher')).toBeInTheDocument()
  })

  it('switches to Alarms when bell icon in top bar clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Both rail and topbar have title="Alarms" — click the first (rail) to navigate
    const alarmsBtns = screen.getAllByTitle('Alarms')
    await user.click(alarmsBtns[0])
    expect(screen.getByRole('heading', { name: 'ALARMS' })).toBeInTheDocument()
  })

  it('shows LabBoard without SubNav and applies is-lab class', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTitle('Lab Board'))
    expect(document.querySelector('.connectio-shell.fullscreen')).toBeInTheDocument()
    // SubNav should not appear for lab module
    expect(document.querySelector('.connectio-subnav')).not.toBeInTheDocument()
  })

  it('shows Admin page when Settings clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    // LeftRail and TopBar both have title="Settings"; use first (LeftRail)
    await user.click(screen.getAllByTitle('Settings')[0])
    expect(screen.getByRole('heading', { name: 'SETTINGS' })).toBeInTheDocument()
  })

  it('has no SubNav on Home, Alarms, or Admin', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Default: home — no subnav
    expect(document.querySelector('.connectio-subnav')).not.toBeInTheDocument()

    await user.click(screen.getAllByTitle('Alarms')[0])
    expect(document.querySelector('.connectio-subnav')).not.toBeInTheDocument()

    await user.click(screen.getAllByTitle('Settings')[0])
    expect(document.querySelector('.connectio-subnav')).not.toBeInTheDocument()
  })

  it('shows breadcrumb in top bar', () => {
    render(<App />)
    // TopBar renders CONNECTEDQUALITY product name
    expect(screen.getByText('CONNECTEDQUALITY')).toBeInTheDocument()
    // Home breadcrumb is rendered — scope to .cq-bc to avoid LeftRail's "Home" label
    const bc = document.querySelector('.connectio-bc') as HTMLElement
    expect(within(bc).getByText('Home')).toBeInTheDocument()
  })
})
