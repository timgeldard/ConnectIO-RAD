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

  it('shows the left rail with all module buttons', () => {
    render(<App />)
    expect(screen.getByTitle('Home')).toBeInTheDocument()
    expect(screen.getByTitle('Trace')).toBeInTheDocument()
    expect(screen.getByTitle('EnvMon')).toBeInTheDocument()
    expect(screen.getByTitle('SPC')).toBeInTheDocument()
    expect(screen.getByTitle('Lab Board')).toBeInTheDocument()
    expect(screen.getAllByTitle('Alarms')[0]).toBeInTheDocument()
    expect(screen.getAllByTitle('Settings')[0]).toBeInTheDocument()
  })

  it('shows the Home page by default', () => {
    render(<App />)
    expect(document.querySelector('.cq-launcher')).toBeInTheDocument()
  })

  it('switches to Trace module when rail button clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTitle('Trace'))
    // Scope to SubNav — 'Overview' also appears in breadcrumb
    const traceSubnav = document.querySelector('.connectio-subnav') as HTMLElement
    expect(within(traceSubnav).getByText('Overview')).toBeInTheDocument()
    expect(within(traceSubnav).getByText('Recall Readiness')).toBeInTheDocument()
  })

  it('switches to EnvMon module and shows env tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTitle('EnvMon'))
    // Scope to SubNav — 'Global Map' also appears in breadcrumb
    const envSubnav = document.querySelector('.connectio-subnav') as HTMLElement
    expect(within(envSubnav).getByText('Global Map')).toBeInTheDocument()
    expect(within(envSubnav).getByText('Floor Plan')).toBeInTheDocument()
  })

  it('switches to SPC module and shows spc tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTitle('SPC'))
    expect(screen.getByText('Control Charts')).toBeInTheDocument()
    expect(screen.getByText('Process Flow')).toBeInTheDocument()
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

  it('navigates trace tabs independently', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTitle('Trace'))
    // Before clicking, 'Recall Readiness' is unique in SubNav; after clicking it's in SubNav + breadcrumb
    const recallTab = screen.getByText('Recall Readiness')
    await user.click(recallTab)
    const navAfter = document.querySelector('.connectio-subnav') as HTMLElement
    expect(within(navAfter).getByText('Recall Readiness')).toBeInTheDocument()
  })

  it('shows breadcrumb in top bar', () => {
    render(<App />)
    // TopBar renders CONNECTEDQUALITY product name
    expect(screen.getByText('CONNECTEDQUALITY')).toBeInTheDocument()
    // Home breadcrumb is rendered — scope to .cq-bc to avoid LeftRail's "Home" label
    const bc = document.querySelector('.connectio-bc') as HTMLElement
    expect(within(bc).getByText('Home')).toBeInTheDocument()
  })

  it('shows context bar with plant/material/batch', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?plant=CHV&material=MAT1&batch=BAT1')
    render(<App />)
    await user.click(screen.getByTitle('Trace'))
    const ctx = document.querySelector('.connectio-ctx') as HTMLElement
    expect(within(ctx).getByText(/CHV/)).toBeInTheDocument()
    expect(within(ctx).getByText(/MAT1/)).toBeInTheDocument()
    expect(within(ctx).getByText(/BAT1/)).toBeInTheDocument()
    window.history.replaceState({}, '', '/')
  })

  it('Home module cards navigate to sub-modules on click', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Click the mod card by CSS selector — "TRACE" text also appears in inbox rows
    const traceCard = document.querySelector('.cq-mod-card.mod-trace') as HTMLElement
    await user.click(traceCard)
    // Should switch to trace module showing tabs
    expect(screen.getByText('Recall Readiness')).toBeInTheDocument()
  })
})
