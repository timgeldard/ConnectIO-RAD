import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { HomePanel } from '../shell/HomePanel'

describe('HomePanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the shell-owned platform session endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Ops Lead' }),
    } as Response)

    render(<HomePanel />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/platform/me')
      expect(screen.getByText('Welcome back, Ops Lead')).toBeTruthy()
    })
  })

  it('shows plain Welcome when fetch returns a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)
    render(<HomePanel />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/platform/me'))
    expect(screen.getByText('Welcome')).toBeTruthy()
  })

  it('shows plain Welcome when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'))
    render(<HomePanel />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/platform/me'))
    expect(screen.getByText('Welcome')).toBeTruthy()
  })

  it('searches across dynamically registered modules', async () => {
    const modules: ConnectIOModule[] = [
      {
        moduleId: 'supplier-quality',
        displayName: 'Supplier Quality',
        shortName: 'SUPQUAL',
        tagline: 'Vendor scorecards',
        domain: 'quality',
        iconSet: 'shared-ui',
        icon: 'chart',
        color: '#289BA2',
        sidebarGroup: 'quality',
        sidebarOrder: 90,
        defaultTab: 'overview',
        tabs: [],
        landingCard: { tag: 'Supplier', desc: 'Supplier demo module', stats: [] },
        contextBarSlot: false,
        routeBase: '/supplier-quality/',
        i18nNamespace: 'supplier-quality',
        isUserSelectable: true,
        isPinnedByDefault: false,
        isMandatory: false,
        backendPrefix: '/api/supplier-quality',
      },
    ]

    render(<HomePanel modules={modules} sessionName="Ops Lead" />)
    expect(screen.getByText('Supplier Quality')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search apps'), { target: { value: 'trace' } })

    expect(screen.queryByText('Supplier Quality')).toBeNull()
    expect(screen.getByText('No registered apps match your search.')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
