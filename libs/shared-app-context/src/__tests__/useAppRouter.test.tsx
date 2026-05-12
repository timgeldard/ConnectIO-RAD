import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, describe, beforeEach, vi } from 'vitest'
import { useAppRouter } from '../useAppRouter'

type R = 'overview' | 'imr' | 'capability'
const ROUTES: R[] = ['overview', 'imr', 'capability']

function Harness({ onNavigate }: { onNavigate?: (r: R) => void } = {}) {
  const { route, navigate, isDefault } = useAppRouter<R>({
    routes: ROUTES,
    defaultRoute: 'overview',
    onNavigate,
  })
  return (
    <div>
      <span data-testid="route">{route}</span>
      <span data-testid="default">{String(isDefault)}</span>
      <button onClick={() => navigate('imr')}>imr</button>
      <button onClick={() => navigate('capability')}>capability</button>
      <button onClick={() => navigate('overview')}>overview</button>
    </div>
  )
}

describe('useAppRouter', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  test('defaults to defaultRoute when URL has no param', () => {
    render(<Harness />)
    expect(screen.getByTestId('route').textContent).toBe('overview')
    expect(screen.getByTestId('default').textContent).toBe('true')
  })

  test('reads existing URL ?view=... param on mount', () => {
    window.history.replaceState({}, '', '/?view=imr')
    render(<Harness />)
    expect(screen.getByTestId('route').textContent).toBe('imr')
    expect(screen.getByTestId('default').textContent).toBe('false')
  })

  test('falls back to default when URL carries an unknown route', () => {
    window.history.replaceState({}, '', '/?view=nope')
    render(<Harness />)
    expect(screen.getByTestId('route').textContent).toBe('overview')
  })

  test('navigate() updates the URL and the rendered route', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('imr'))
    expect(screen.getByTestId('route').textContent).toBe('imr')
    expect(window.location.search).toBe('?view=imr')
  })

  test('navigating back to defaultRoute removes the URL param', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('imr'))
    expect(window.location.search).toBe('?view=imr')
    await userEvent.click(screen.getByText('overview'))
    expect(window.location.search).toBe('')
  })

  test('calls onNavigate when supplied', async () => {
    const cb = vi.fn()
    render(<Harness onNavigate={cb} />)
    await userEvent.click(screen.getByText('capability'))
    expect(cb).toHaveBeenCalledWith('capability')
  })

  test('responds to popstate (browser back/forward)', () => {
    render(<Harness />)
    act(() => {
      window.history.replaceState({}, '', '/?view=capability')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('route').textContent).toBe('capability')
  })
})
