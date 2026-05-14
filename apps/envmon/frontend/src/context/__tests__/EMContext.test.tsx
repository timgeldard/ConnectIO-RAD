/* eslint-disable jsdoc/require-jsdoc */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { EMProvider, useEM } from '../EMContext'
import type { ReactNode } from 'react'

describe('EMContext', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('provides default values', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    expect(result.current.view.level).toBe('global')
    expect(result.current.personaId).toBe('regional')
    expect(result.current.activeFloor).toBeNull()
  })

  it('updates view and active floor', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    act(() => {
      result.current.setView({ level: 'site', plantId: 'P1', floorId: 'F2' })
    })

    expect(result.current.view.level).toBe('site')
    expect(result.current.activeFloor).toBe('F2')
    expect(localStorage.getItem('em_view')).toBeNull()
    expect(sessionStorage.getItem('em_view')).toContain('site')
  })

  it('clears session state on logout event', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    act(() => {
      result.current.setView({ level: 'site', plantId: 'P1', floorId: 'F2' })
      result.current.setPersonaId('site')
      result.current.setPortfolioDays(90)
    })
    expect(sessionStorage.getItem('em_view')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('connectio:logout'))
    })

    expect(sessionStorage.getItem('em_view')).toBeNull()
    expect(sessionStorage.getItem('em_persona')).toBeNull()
    expect(sessionStorage.getItem('em_portfolio_days')).toBeNull()
  })

  it('ignores expired session state', () => {
    sessionStorage.setItem(
      'em_view',
      JSON.stringify({
        value: { level: 'site', plantId: 'P1', floorId: 'F2' },
        expiresAt: Date.now() - 1,
      }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => <EMProvider>{children}</EMProvider>

    const { result } = renderHook(() => useEM(), { wrapper })

    expect(['global', 'site']).toContain(result.current.view.level)
    expect(sessionStorage.getItem('em_view')).toBeNull()
  })

  it('updates active floor and syncs url', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    act(() => {
      result.current.setActiveFloor('F3')
    })

    expect(result.current.activeFloor).toBe('F3')
    expect(window.location.search).toContain('floor=F3')
  })
})
