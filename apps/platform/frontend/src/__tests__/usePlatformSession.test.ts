/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePlatformSession } from '../shell/usePlatformSession'

describe('usePlatformSession', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('initially returns empty session', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => usePlatformSession())
    expect(result.current.groups).toEqual([])
  })

  it('loads session from backend', async () => {
    const mockSession = {
      userId: 'u123',
      email: 'user@example.com',
      name: 'Test User',
      groups: ['admin', 'viewer']
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession)
    })

    const { result } = renderHook(() => usePlatformSession())

    await waitFor(() => expect(result.current.userId).toBe('u123'))
    expect(result.current.groups).toEqual(['admin', 'viewer'])
  })

  it('handles invalid groups data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ userId: 'u123', groups: 'not-an-array' })
    })

    const { result } = renderHook(() => usePlatformSession())

    await waitFor(() => expect(result.current.userId).toBe('u123'))
    expect(result.current.groups).toEqual([])
  })

  it('stays on empty session if fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    const { result } = renderHook(() => usePlatformSession())
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(result.current.groups).toEqual([])
  })
})
