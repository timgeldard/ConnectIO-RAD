import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

    render(<HomePanel onModuleChange={() => {}} />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/platform/me')
    })
    expect(screen.getByText('Welcome back, Ops')).toBeTruthy()
  })
})
