import { renderHook } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useSPCComputedAnalytics } from '../hooks/useSPCComputedAnalytics'

// Mock computeAnalytics (main thread fallback)
vi.mock('../computeAnalytics', () => ({
  computeAnalytics: vi.fn(() => ({
    spc: { signals: [] },
    trendData: [],
    stratumSections: []
  }))
}))

describe('useSPCComputedAnalytics', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', undefined)
  })

  it('computes analytics on main thread when no worker', () => {
    const mockPoints = [{ batch_id: 'B1', value: 10 }]
    const excludedIndices = new Set<number>()
    const { result } = renderHook(() => useSPCComputedAnalytics({
      points: mockPoints as any,
      chartType: 'imr',
      excludedIndices,
      ruleSet: 'weco',
      excludeOutliers: false,
      normality: null,
      stratifyBy: null,
      rollingWindowSize: 10,
      ewmaLambda: 0.2,
      ewmaL: 3,
      cusumK: 0.5,
      cusumH: 5
    }))
    
    expect(result.current.analyticsLoading).toBe(false)
    expect(result.current.spc).not.toBeNull()
  })

  it('returns null state when no chartType', () => {
    const points: any[] = []
    const excludedIndices = new Set<number>()
    const { result } = renderHook(() => useSPCComputedAnalytics({
      points,
      chartType: null,
      excludedIndices,
      ruleSet: 'weco',
      excludeOutliers: false,
      normality: null,
      stratifyBy: null,
      rollingWindowSize: 10,
      ewmaLambda: 0.2,
      ewmaL: 3,
      cusumK: 0.5,
      cusumH: 5
    }))
    
    expect(result.current.spc).toBeNull()
  })
})
