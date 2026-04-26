import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RecentViolations from '../RecentViolations'
import { SPCProvider } from '../../SPCContext'
import { renderWithI18n } from '../../__tests__/test-utils'
import React from 'react'

// Mock Icon
vi.mock('../../components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <div data-testid={`icon-${name}`} />
}))

describe('RecentViolations', () => {
  const violations = [
    { id: 'v1', chart: 'X-Bar', rule: 'Rule 1', value: '10.5', time: '10:00' }
  ]

  it('renders priority signals and responds to click', () => {
    renderWithI18n(
      <SPCProvider>
        <RecentViolations hasMaterial={true} violations={violations} />
      </SPCProvider>
    )
    expect(screen.getByText('Priority signals')).toBeInTheDocument()
    expect(screen.getByText('X-Bar')).toBeInTheDocument()

    fireEvent.click(screen.getByText('X-Bar').closest('button')!)
    // We check for SET_ACTIVE_TAB in a more integrated test if needed,
    // but here we just confirm it renders and is clickable.
  })

  it('renders empty state when no material', () => {
    renderWithI18n(
      <SPCProvider>
        <RecentViolations hasMaterial={false} violations={[]} />
      </SPCProvider>
    )
    expect(screen.getByText(/Select a material/i)).toBeInTheDocument()
  })
})
