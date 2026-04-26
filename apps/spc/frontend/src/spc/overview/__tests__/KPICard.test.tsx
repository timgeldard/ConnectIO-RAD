import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import KPICard from '../KPICard'
import React from 'react'

// Mock Icon and Sparkline
vi.mock('../../components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <div data-testid={`icon-${name}`} />
}))

describe('KPICard', () => {
  it('renders KPICard with value', () => {
    render(<KPICard label="Yield" value="98.5" unit="%" tone="ok" sparkline={[1, 2, 3]} />)
    expect(screen.getByText('Yield')).toBeInTheDocument()
    expect(screen.getByText('98.5')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
  })
})
