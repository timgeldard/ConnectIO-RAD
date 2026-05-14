import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, describe, beforeEach, vi } from 'vitest'
import { createAppRouterActions, useAppRouter } from '../useAppRouter'

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

class TestBoundary extends React.Component<{ children: React.ReactNode }, { message: string | null }> {
  state = { message: null }

  componentDidCatch(error: Error) {
    this.setState({ message: error.message })
  }

  render() {
    if (this.state.message) {
      return <span data-testid="router-action-error">{this.state.message}</span>
    }
    return this.props.children
  }
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

describe('createAppRouterActions', () => {
  type Actions = {
    openOrder: (id: string) => void
  }

  const { Provider, useActions } = createAppRouterActions<Actions>('TestRouterActions')

  function ActionsHarness({ actions }: { actions: Actions }) {
    return (
      <Provider value={actions}>
        <ActionsButton />
      </Provider>
    )
  }

  function ActionsButton() {
    const { openOrder } = useActions()
    return <button onClick={() => openOrder('PO-123')}>open</button>
  }

  test('provides typed app router actions to descendants', async () => {
    const actions = { openOrder: vi.fn() }
    render(<ActionsHarness actions={actions} />)
    await userEvent.click(screen.getByText('open'))
    expect(actions.openOrder).toHaveBeenCalledWith('PO-123')
  })

  test('throws when actions are used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <TestBoundary>
        <ActionsButton />
      </TestBoundary>,
    )
    expect(screen.getByTestId('router-action-error').textContent).toMatch(/TestRouterActions/)
    spy.mockRestore()
  })
})
