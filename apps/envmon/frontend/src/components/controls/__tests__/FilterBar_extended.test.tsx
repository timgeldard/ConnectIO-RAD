/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FilterBar from '../FilterBar'
import { EMProvider } from '~/context/EMContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock useMics and useHeatmap
vi.mock('~/api/client', () => ({
  useMics: vi.fn(() => ({ data: ['MIC1', 'MIC2'], isLoading: false })),
  useHeatmap: vi.fn(() => ({ data: { markers: [] }, isLoading: false })),
}))

const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <EMProvider>
      {children}
    </EMProvider>
  </QueryClientProvider>
)

describe('FilterBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders time window and mode selectors', () => {
    render(<FilterBar />, { wrapper })
    
    expect(screen.getByText(/timeWindow/i)).toBeDefined()
    expect(screen.getByText(/heatmapMode/i)).toBeDefined()
    expect(screen.getByText(/deterministic/i)).toBeDefined()
    expect(screen.getByText(/continuous/i)).toBeDefined()
  })

  it('toggles heatmap mode', () => {
    render(<FilterBar />, { wrapper })
    
    const continuousBtn = screen.getByText(/continuous/i)
    fireEvent.click(continuousBtn)
    
    // Sensitivity slider should appear in continuous mode
    expect(screen.getByText(/sensitivity/i)).toBeDefined()
  })

  it('toggles MIC filters', () => {
    render(<FilterBar />, { wrapper })
    
    const micBtn = screen.getByText('MIC1')
    fireEvent.click(micBtn)
    
    expect(micBtn.className).toContain('active')
    
    const clearBtn = screen.getByText(/clearFilter/i)
    fireEvent.click(clearBtn)
    
    expect(micBtn.className).not.toContain('active')
  })
})
