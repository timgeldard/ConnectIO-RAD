/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePlatformRegistry } from '../shell/usePlatformRegistry'
import * as moduleManifest from '../shell/moduleManifest'

describe('usePlatformRegistry', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Mock getLocalPlatformManifest to return a simple manifest
    vi.spyOn(moduleManifest, 'getLocalPlatformManifest').mockReturnValue({
      version: 1,
      modules: [],
      featureFlags: {}
    })
  })

  it('initially returns local manifest source', async () => {
    // Mock a pending fetch
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => usePlatformRegistry([], []))

    expect(result.current.source).toBe('local')
    expect(result.current.manifest.version).toBe(1)
  })

  it('switches to backend source after successful fetch', async () => {
    const mockManifest = {
      version: 2,
      modules: [
        {
          moduleId: 'dynamic-app',
          displayName: 'Dynamic App',
          shortName: 'DYN',
          routeBase: '/dyn/',
          backendPrefix: '/api/dyn'
        }
      ],
      featureFlags: {}
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    })

    const { result } = renderHook(() => usePlatformRegistry([], []))

    await waitFor(() => expect(result.current.source).toBe('backend'))
    expect(result.current.manifest.version).toBe(2)
    expect(result.current.modules.some(m => m.moduleId === 'dynamic-app')).toBe(true)
  })

  it('stays on local source if fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    })

    const { result } = renderHook(() => usePlatformRegistry([], []))

    // Wait a bit to ensure fetch would have completed
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(result.current.source).toBe('local')
  })

  it('stays on local source if fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => usePlatformRegistry([], []))

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(result.current.source).toBe('local')
  })
})
