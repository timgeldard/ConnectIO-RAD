import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBadgeCounts } from '../shell/useBadgeCounts'

describe('useBadgeCounts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('initially returns empty badges and fetches immediately', async () => {
    const mockData = { 'poh-orders': 5 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => useBadgeCounts())

    expect(result.current).toEqual({})
    
    await waitFor(() => {
      expect(result.current).toEqual(mockData)
    })
    expect(fetch).toHaveBeenCalledWith('/api/badges')
  })

  it('polls for new counts every 60 seconds', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ 'poh-orders': 5 }),
    } as Response)

    renderHook(() => useBadgeCounts())
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    // Advance 60s
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetch).toHaveBeenCalledTimes(2)

    // Advance another 60s
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('handles fetch errors by returning existing or empty counts', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useBadgeCounts())
    
    // Should stay empty on initial error
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toEqual({})
  })

  it('cleans up interval on unmount', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const { unmount } = renderHook(() => useBadgeCounts())
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    // Should NOT have called fetch again
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
