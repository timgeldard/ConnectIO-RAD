import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSPCChartData } from '../hooks/useSPCChartData'

describe('useSPCChartData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches chart data successfully', async () => {
    const mockPoints = [{ batch_id: 'B1', value: 10 }]
    const mockResponse = {
      data: mockPoints,
      has_more: false,
      normality: { is_normal: true },
      spec_drift: null
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const { result } = renderHook(() => useSPCChartData('M1', 'C1', 'MIC 1', '2024-01-01', '2024-12-31', 'P1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.points).toHaveLength(1)
    expect(result.current.points[0].batch_id).toBe('B1')
    expect(result.current.normality?.is_normal).toBe(true)
  })

  it('handles fetch error', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ detail: 'Internal Server Error' })
    })

    const { result } = renderHook(() => useSPCChartData('M1', 'C1', 'MIC 1', '2024-01-01', '2024-01-31', 'P1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain('Internal Server Error')
  })
})
