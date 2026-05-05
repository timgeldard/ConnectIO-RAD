import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinnedModules } from '../shell/usePinnedModules'

// jsdom localStorage stub — the default jsdom localStorage doesn't fully implement Storage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { for (const k of Object.keys(store)) delete store[k] },
  get length() { return Object.keys(store).length },
  key: (i: number) => Object.keys(store)[i] ?? null,
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock)
  localStorageMock.clear()
})

describe('usePinnedModules', () => {
  it('returns null when no preferences are saved', () => {
    const { result } = renderHook(() => usePinnedModules())
    expect(result.current[0]).toBeNull()
  })

  it('pins a module and returns it in the list', () => {
    const { result } = renderHook(() => usePinnedModules())
    act(() => result.current[1]('spc', true))
    expect(result.current[0]).toContain('spc')
  })

  it('unpins a module and removes it from the list', () => {
    localStorageMock.setItem('connectio.pinnedModules', JSON.stringify(['spc', 'trace']))
    const { result } = renderHook(() => usePinnedModules())
    expect(result.current[0]).toContain('spc')
    act(() => result.current[1]('spc', false))
    expect(result.current[0]).not.toContain('spc')
    expect(result.current[0]).toContain('trace')
  })

  it('returns null when the last pin is removed', () => {
    localStorageMock.setItem('connectio.pinnedModules', JSON.stringify(['spc']))
    const { result } = renderHook(() => usePinnedModules())
    act(() => result.current[1]('spc', false))
    expect(result.current[0]).toBeNull()
  })

  it('persists pins to localStorage', () => {
    const { result } = renderHook(() => usePinnedModules())
    act(() => result.current[1]('envmon', true))
    const stored = JSON.parse(localStorageMock.getItem('connectio.pinnedModules') ?? '[]') as string[]
    expect(stored).toContain('envmon')
  })

  it('does not duplicate pins when pinning an already-pinned module', () => {
    localStorageMock.setItem('connectio.pinnedModules', JSON.stringify(['spc']))
    const { result } = renderHook(() => usePinnedModules())
    act(() => result.current[1]('spc', true))
    expect(result.current[0]?.filter((id) => id === 'spc')).toHaveLength(1)
  })

  it('reads initial state from localStorage', () => {
    localStorageMock.setItem('connectio.pinnedModules', JSON.stringify(['trace', 'envmon']))
    const { result } = renderHook(() => usePinnedModules())
    expect(result.current[0]).toEqual(['trace', 'envmon'])
  })
})
