import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SPCPage from '../SPCPage'
import React from 'react'

// Mock context to control activeTab
vi.mock('../SPCContext', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSPCSelector: vi.fn((selector) => selector({ 
      activeTab: 'overview',
      savedViews: [],
      ruleSet: 'weco',
      excludeOutliers: false,
      limitsMode: 'live',
      selectedMaterial: null,
      selectedPlant: null,
      selectedMIC: null,
      isLoading: false,
      kpis: { processHealth: 100, avgCpk: 1.5, oocPoints: 0, affectedBatches: 0 },
      recentViolations: [],
      selectedMultivariateMicIds: [],
    }))
  }
})

// Mock lazy components
vi.mock('../SPCFilterBar', () => ({ default: () => <div data-testid="mock-filter-bar" /> }))
vi.mock('../SPCPageHeader', () => ({ default: () => <div data-testid="mock-header" /> }))
vi.mock('../overview/OverviewPage', () => ({ default: () => <div data-testid="view-overview" /> }))
vi.mock('../flow/ProcessFlowView', () => ({ default: () => <div data-testid="view-flow" /> }))
vi.mock('../charts/ControlChartsView', () => ({ default: () => <div data-testid="view-charts" /> }))
vi.mock('../scorecard/ScorecardView', () => ({ default: () => <div data-testid="view-scorecard" /> }))

// Mock hooks
vi.mock('../hooks/useSPCUrlSync', () => ({ useSPCUrlSync: vi.fn() }))
vi.mock('../hooks/useSPCPreferences', () => ({ useSPCPreferences: vi.fn() }))

describe('SPCPage', () => {
  it('renders overview tab by default', async () => {
    render(<SPCPage />)
    
    // Lazy components in Suspense need a bit of time or proper mocking
    expect(await screen.findByTestId('mock-filter-bar')).toBeInTheDocument()
    expect(await screen.findByTestId('view-overview')).toBeInTheDocument()
  })
})
