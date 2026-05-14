import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChartContainer } from './ChartContainer'

describe('ChartContainer', () => {
  it('renders children', () => {
    render(<ChartContainer><p>chart here</p></ChartContainer>)
    expect(screen.getByText('chart here')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<ChartContainer title="OEE Chart"><div /></ChartContainer>)
    expect(screen.getByRole('heading', { level: 2, name: 'OEE Chart' })).toBeInTheDocument()
  })

  it('does not render header when no title or description', () => {
    const { container } = render(<ChartContainer><div /></ChartContainer>)
    expect(container.querySelector('header')).not.toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<ChartContainer title="Chart" description="30-day window"><div /></ChartContainer>)
    expect(screen.getByText('30-day window')).toBeInTheDocument()
  })

  it('applies minimum height style', () => {
    const { container } = render(<ChartContainer height={400}><div /></ChartContainer>)
    expect((container.firstChild as HTMLElement).style.minHeight).toBe('400px')
  })
})
