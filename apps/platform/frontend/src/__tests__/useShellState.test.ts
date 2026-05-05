import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShellState } from '../shell/useShellState'

function setSearch(qs: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search: qs },
  })
}

beforeEach(() => {
  setSearch('')
  vi.spyOn(history, 'replaceState').mockImplementation(() => undefined)
})

describe('useShellState', () => {
  it('defaults to the composition defaultModule when no URL param', () => {
    const { result } = renderHook(() => useShellState())
    expect(result.current[0].activeModuleId).toBe('trace')
  })

  it('reads ?module= from the URL on init', () => {
    setSearch('?module=spc')
    const { result } = renderHook(() => useShellState())
    expect(result.current[0].activeModuleId).toBe('spc')
  })

  it('reads ?tab= into tabState on init', () => {
    setSearch('?module=spc&tab=alarms')
    const { result } = renderHook(() => useShellState())
    expect(result.current[0].tabState['spc']).toBe('alarms')
  })

  it('onModuleChange updates activeModuleId', () => {
    const { result } = renderHook(() => useShellState())
    act(() => result.current[1].onModuleChange('envmon'))
    expect(result.current[0].activeModuleId).toBe('envmon')
  })

  it('onModuleChange calls history.replaceState', () => {
    const { result } = renderHook(() => useShellState())
    act(() => result.current[1].onModuleChange('spc'))
    expect(history.replaceState).toHaveBeenCalled()
  })

  it('onTabChange updates tabState for the module', () => {
    const { result } = renderHook(() => useShellState())
    act(() => result.current[1].onModuleChange('spc'))
    act(() => result.current[1].onTabChange('spc', 'charts'))
    expect(result.current[0].tabState['spc']).toBe('charts')
  })

  it('onClearContext sets ctxState to null', () => {
    setSearch('?module=spc&entity=processOrder&processOrderId=1001&from=trace')
    const { result } = renderHook(() => useShellState())
    expect(result.current[0].ctxState).not.toBeNull()
    act(() => result.current[1].onClearContext())
    expect(result.current[0].ctxState).toBeNull()
  })

  it('onTabChange preserves cross-app context params in URL', () => {
    setSearch('?module=spc&tab=charts&entity=processOrder&processOrderId=1001&from=trace')
    const { result } = renderHook(() => useShellState())
    act(() => result.current[1].onTabChange('spc', 'alarms'))
    const calls = vi.mocked(history.replaceState).mock.calls
    const lastUrl = calls[calls.length - 1][2] as string
    const params = new URLSearchParams(lastUrl.startsWith('?') ? lastUrl.slice(1) : lastUrl)
    expect(params.get('entity')).toBe('processOrder')
    expect(params.get('processOrderId')).toBe('1001')
    expect(params.get('from')).toBe('trace')
    expect(params.get('tab')).toBe('alarms')
  })

  it('ctxState is null when no entity param in URL', () => {
    setSearch('?module=spc')
    const { result } = renderHook(() => useShellState())
    expect(result.current[0].ctxState).toBeNull()
  })
})
