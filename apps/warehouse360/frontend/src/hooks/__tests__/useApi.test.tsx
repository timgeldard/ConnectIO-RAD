import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApi } from '../useApi'
import { PlantProvider } from '../../context/PlantContext'

// Mock fetch
const globalFetch = vi.fn()
vi.stubGlobal('fetch', globalFetch)

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlantProvider>
    {children}
  </PlantProvider>
)

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalFetch.mockReset()
  })

  it('fetches data and returns it', async () => {
    const mockData = { test: 123 }
    globalFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    })

    const { result } = renderHook(() => useApi('/api/test'), { wrapper })

    expect(result.current.loading).toBe(true)
    
    await waitFor(() => expect(result.current.loading).toBe(false))
    
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(globalFetch).toHaveBeenCalledWith(expect.stringContaining('/api/test'))
  })

  it('handles fetch errors', async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const { result } = renderHook(() => useApi('/api/fail'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('404 Not Found')
  })

  it('handles network exceptions', async () => {
    globalFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useApi('/api/crash'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    
    expect(result.current.error).toBe('Network error')
  })
})
