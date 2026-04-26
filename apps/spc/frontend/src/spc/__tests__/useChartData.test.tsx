import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useChartData } from '../hooks/useChartData'

// Mock sub-hooks
vi.mock('../hooks/useSPCChartData', () => ({
  useSPCChartData: () => ({ points: [], loading: false, error: null })
}))
vi.mock('../hooks/usePChartData', () => ({
  usePChartData: () => ({ points: [], loading: false, error: null })
}))
vi.mock('../hooks/useCountChartData', () => ({
  useCountChartData: () => ({ points: [], loading: false, error: null })
}))

describe('useChartData', () => {
  it('determines quantitative chart type correctly', () => {
    const { result } = renderHook(() => useChartData(
      'M1', 'C1', 'MIC 1', 'imr', null, 'p_chart', '2024-01-01', '2024-12-31', null, null
    ))
    
    expect(result.current.isQuantitative).toBe(true)
    expect(result.current.isAttributeChart).toBe(false)
    expect(result.current.effectiveChartType).toBe('imr')
  })

  it('determines attribute chart type correctly', () => {
    const { result } = renderHook(() => useChartData(
      'M1', 'C1', 'MIC 1', 'p_chart', null, 'p_chart', '2024-01-01', '2024-12-31', null, null
    ))
    
    expect(result.current.isQuantitative).toBe(false)
    expect(result.current.isAttributeChart).toBe(true)
    expect(result.current.isPChart).toBe(true)
  })
})
