/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LandingCard, moduleHref } from '../LandingCard'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'

describe('LandingCard', () => {
  const mockModule: ConnectIOModule = {
    moduleId: 'test-mod',
    displayName: 'Test Module',
    routeBase: '/test',
    color: '#ff0000',
    landingCard: {
      tag: 'NEW',
      desc: 'Test description',
      stats: [{ label: 'Stat 1', value: '100', tone: 'ok' }],
    }
  } as any

  it('renders module details', () => {
    render(<LandingCard mod={mockModule} />)
    
    expect(screen.getByText('Test Module')).toBeDefined()
    expect(screen.getByText('Test description')).toBeDefined()
    expect(screen.getByText('NEW')).toBeDefined()
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Stat 1')).toBeDefined()
  })

  it('returns null if landingCard is missing', () => {
    const { container } = render(<LandingCard mod={{ ...mockModule, landingCard: undefined }} />)
    expect(container.firstChild).toBeNull()
  })

  it('moduleHref builds correct URLs', () => {
    const mod = { routeBase: '/poh', moduleId: 'pours' } as any
    expect(moduleHref(mod)).toBe('/poh/?module=pours')
    expect(moduleHref(mod, 'history')).toBe('/poh/?module=pours&tab=history')
    
    const standalone = { routeBase: '/lab/' } as any
    expect(moduleHref(standalone)).toBe('/lab/')
  })
})
