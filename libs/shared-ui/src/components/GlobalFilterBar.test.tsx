import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GlobalFilterBar } from './GlobalFilterBar'

describe('GlobalFilterBar', () => {
  it('renders children', () => {
    render(<GlobalFilterBar><button>30D</button></GlobalFilterBar>)
    expect(screen.getByRole('button', { name: '30D' })).toBeInTheDocument()
  })

  it('returns null when no children', () => {
    const { container } = render(<GlobalFilterBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders with data-testid filter-bar', () => {
    render(<GlobalFilterBar><span>x</span></GlobalFilterBar>)
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })
})
