import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KPI } from './KPI'

describe('KPI', () => {
  it('renders label and value', () => {
    render(<KPI label="OEE" value="87.4" />)
    expect(screen.getByTestId('kpi-label')).toHaveTextContent('OEE')
    expect(screen.getByText('87.4')).toBeInTheDocument()
  })

  it('renders unit when provided', () => {
    render(<KPI label="OEE" value="87.4" unit="%" />)
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('applies tone data attribute', () => {
    render(<KPI label="OEE" value="87.4" tone="risk" />)
    expect(screen.getByTestId('kpi-card')).toHaveAttribute('data-tone', 'risk')
  })

  it('renders delta text when provided', () => {
    render(<KPI label="OEE" value="87.4" delta="+2.1%" />)
    expect(screen.getByText('+2.1%')).toBeInTheDocument()
  })

  it('renders subtext when provided', () => {
    render(<KPI label="OEE" value="87.4" subtext="vs prior 7 days" />)
    expect(screen.getByText('vs prior 7 days')).toBeInTheDocument()
  })
})
