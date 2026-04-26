import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useControlChartsController } from '../hooks/useControlChartsController'
import { SPCProvider } from '../SPCContext'
import React from 'react'

// Mock all internal hooks
vi.mock('../hooks/useChartData', () => ({ useChartData: () => ({ points: [], loading: false, error: null }) }))
vi.mock('../hooks/useChartSettings', () => ({ useChartSettings: () => ({ quantChartType: 'IMR', ewmaLambda: 0.2 }) }))
vi.mock('../hooks/useLockedLimits', () => ({ useLockedLimits: () => ({ lockedLimits: null }) }))
vi.mock('../hooks/useGovernedControlLimits', () => ({ useGovernedControlLimits: () => ({ governedLimits: null }) }))
vi.mock('../hooks/useExport', () => ({ useExport: () => ({ exportCSV: vi.fn() }) }))
vi.mock('../hooks/useExclusionWorkflow', () => ({ useExclusionWorkflow: () => ({}) }))
vi.mock('../hooks/useSPCComputedAnalytics', () => ({ useSPCComputedAnalytics: () => ({ spc: null }) }))

describe('useControlChartsController', () => {
  it('aggregates state from multiple hooks', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SPCProvider>{children}</SPCProvider>
    )
    const { result } = renderHook(() => useControlChartsController(), { wrapper })
    
    // Default state
    expect(result.current.loading).toBe(false)
    expect(result.current.points).toEqual([])
    expect(result.current.isQuantitative).toBe(undefined) // default is no MIC selected
  })
})
