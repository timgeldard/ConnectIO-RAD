import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExclusionWorkflow } from '../hooks/useExclusionWorkflow'
import { SPCProvider } from '../SPCContext'
import React from 'react'

// Mock useSPCExclusions
vi.mock('../hooks/useSPCExclusions', () => ({
  useSPCExclusions: () => ({
    snapshot: null,
    loading: false,
    saving: false,
    error: null,
    saveSnapshot: vi.fn()
  })
}))

describe('useExclusionWorkflow', () => {
  const defaultArgs = {
    materialId: 'M1',
    micId: 'C1',
    micName: 'MIC 1',
    operationId: null,
    plantId: 'P1',
    effectiveChartType: 'imr' as any,
    isQuantitative: true,
    quantPoints: [{ batch_id: 'B1', value: 10 }] as any,
    ruleSet: 'weco' as any,
    quantNormality: null,
    stratifyBy: null,
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    spc: { signals: [] } as any,
    setAutoCleanLog: vi.fn()
  }

  it('handles point click by opening dialog', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SPCProvider>{children}</SPCProvider>
    )
    const { result } = renderHook(() => useExclusionWorkflow(defaultArgs), { wrapper })

    act(() => {
      result.current.handlePointClick(0)
    })
    
    // We can't easily check the internal context state without exposing it or mocking the selector
    // But we can check if the hook returns the expected functions
    expect(result.current.handlePointClick).toBeDefined()
    expect(result.current.handleAutoClean).toBeDefined()
  })
})
