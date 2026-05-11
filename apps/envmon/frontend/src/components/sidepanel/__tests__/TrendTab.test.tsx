/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TrendTab from '../TrendTab'
import { useTrends, useMics } from '~/api/client'
import { EMProvider } from '~/context/EMContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('~/api/client', () => ({
  useTrends: vi.fn(),
  useMics: vi.fn(),
}))

const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <EMProvider>
      {children}
    </EMProvider>
  </QueryClientProvider>
)

describe('TrendTab', () => {
  it('renders prompt when no MIC is selected', () => {
    vi.mocked(useMics).mockReturnValue({ data: [], isLoading: false } as any)
    vi.mocked(useTrends).mockReturnValue({ data: null, isLoading: false } as any)

    render(<TrendTab plantId="C351" funcLocId="LOC1" />, { wrapper })
    
    expect(screen.getByText('envmon.trend.promptSelectMic')).toBeDefined()
  })

  it('renders chart when data is available', () => {
    vi.mocked(useMics).mockReturnValue({ data: ['MIC1'], isLoading: false } as any)
    vi.mocked(useTrends).mockReturnValue({
      data: {
        points: [
          { inspection_date: '2024-01-01', result_value: 10, valuation: 'A' },
          { inspection_date: '2024-01-02', result_value: 12, valuation: 'W' },
        ]
      },
      isLoading: false
    } as any)

    const { container } = render(<TrendTab plantId="C351" funcLocId="LOC1" />, { wrapper })
    
    expect(container.querySelector('svg.trend-chart')).toBeDefined()
    expect(screen.getAllByText(/MIC1/)).toHaveLength(2)
  })
})
