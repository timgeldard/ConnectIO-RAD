import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CapabilityGauge from '../charts/CapabilityGauge'
import CapabilityHistogram from '../charts/CapabilityHistogram'
import IndividualsChart from '../charts/IndividualsChart'
import XbarChart from '../charts/XbarChart'
import CUSUMChart from '../charts/CUSUMChart'

vi.mock('../charts/EChart', () => ({
  default: () => <div data-testid="mock-echart" />
}))

describe('Other Charts', () => {
  it('renders CapabilityGauge', () => {
    render(<CapabilityGauge value={1.5} label="Cpk" />)
    expect(screen.getByText('Cpk')).toBeInTheDocument()
    expect(screen.getByText('1.50')).toBeInTheDocument()
  })

  it('renders CapabilityHistogram', () => {
    const mockSpc = {
      capability: { usl: 10, lsl: 0, xBar: 5, sigmaOverall: 1 },
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    }
    render(<CapabilityHistogram spc={mockSpc as any} />)
    expect(screen.getByText('Capability Histogram')).toBeInTheDocument()
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })

  it('renders IndividualsChart', () => {
    const mockSpc = {
      imr: { xBar: 10, ucl_x: 12, lcl_x: 8, sigma1: 0.5, sigma2: 1.0, sigmaMethod: 'mssd' }
    }
    const mockIndexedPoints = [{ batch_id: 'B1', value: 10, originalIndex: 0 }]
    render(<IndividualsChart spc={mockSpc as any} indexedPoints={mockIndexedPoints as any} />)
    expect(screen.getByText(/Individuals Chart/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })

  it('renders XbarChart', () => {
    const mockSpc = {
      xbarR: { 
        grandMean: 10, ucl_x: 12, lcl_x: 8, sigma1: 0.5, sigma2: 1.0,
        subgroupStats: [{ batchId: 'B1', xbar: 10, n: 5 }]
      }
    }
    render(<XbarChart spc={mockSpc as any} />)
    expect(screen.getByText(/X̄ Chart/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })

  it('renders CUSUMChart', () => {
    const mockSpc = {
      cusum: { 
        h: 5, k: 0.5, 
        points: [{ batch_id: 'B1', s_hi: 0.1, s_lo: -0.1 }] 
      }
    }
    render(<CUSUMChart spc={mockSpc as any} />)
    expect(screen.getByText(/CUSUM Chart/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-echart')).toBeInTheDocument()
  })
})
