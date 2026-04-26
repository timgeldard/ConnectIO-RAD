import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { EMProvider, useEM } from '../EMContext'
import React from 'react'

describe('EMContext', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('provides default values', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    expect(result.current.view.level).toBe('global')
    expect(result.current.personaId).toBe('regional')
    expect(result.current.activeFloor).toBe('F1')
  })

  it('updates view and active floor', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    act(() => {
      result.current.setView({ level: 'site', plantId: 'P1', floorId: 'F2' })
    })

    expect(result.current.view.level).toBe('site')
    expect(result.current.activeFloor).toBe('F2')
    expect(localStorage.getItem('em_view')).toContain('site')
  })

  it('updates active floor and syncs url', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <EMProvider>{children}</EMProvider>
    const { result } = renderHook(() => useEM(), { wrapper })

    act(() => {
      result.current.setActiveFloor('F3')
    })

    expect(result.current.activeFloor).toBe('F3')
    expect(window.location.search).toContain('floor=F3')
  })
})
