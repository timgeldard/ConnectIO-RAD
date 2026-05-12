import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TraceFilterControls, type TraceFilterValue } from '../TraceFilterControls'

function baseValue(overrides: Partial<TraceFilterValue> = {}): TraceFilterValue {
  return {
    direction: 'both',
    depthUpstream: 99,
    depthDownstream: 99,
    groupBy: 'none',
    enabledLinks: new Set(),
    ...overrides,
  }
}

describe('TraceFilterControls', () => {
  test('renders all four control groups by default', () => {
    render(<TraceFilterControls value={baseValue()} onChange={() => {}} />)
    expect(screen.getByTestId('trace-filter-controls')).toBeTruthy()
    expect(screen.getByText('Direction')).toBeTruthy()
    expect(screen.getByText('Upstream depth')).toBeTruthy()
    expect(screen.getByText('Downstream depth')).toBeTruthy()
    expect(screen.getByText('Group by')).toBeTruthy()
    expect(screen.getByText('Link types')).toBeTruthy()
  })

  test('hides the upstream slider when direction === downstream', () => {
    render(
      <TraceFilterControls
        value={baseValue({ direction: 'downstream' })}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText('Upstream depth')).toBeNull()
    expect(screen.getByText('Downstream depth')).toBeTruthy()
  })

  test('clicking the direction segmented button emits a patch', async () => {
    const onChange = vi.fn()
    render(<TraceFilterControls value={baseValue()} onChange={onChange} />)
    await userEvent.click(screen.getByText('Upstream'))
    expect(onChange).toHaveBeenCalledWith({ direction: 'upstream' })
  })

  test('clicking a link chip with the "all" sentinel materialises a partial set', async () => {
    const onChange = vi.fn()
    render(<TraceFilterControls value={baseValue()} onChange={onChange} />)
    await userEvent.click(screen.getByText('RECEIPT'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const patch = onChange.mock.calls[0][0]
    expect(patch.enabledLinks).toBeInstanceOf(Set)
    // Removed RECEIPT from "all" → set contains the other three
    expect(patch.enabledLinks.has('RECEIPT')).toBe(false)
    expect(patch.enabledLinks.size).toBe(3)
  })

  test('toggling the last enabled link does NOT empty the set (always keep at least one)', async () => {
    const onChange = vi.fn()
    render(
      <TraceFilterControls
        value={baseValue({ enabledLinks: new Set(['RECEIPT']) })}
        onChange={onChange}
      />,
    )
    // Click the only enabled chip — would naively empty the set;
    // controls protect against this and instead keep that one item.
    await userEvent.click(screen.getByText('RECEIPT'))
    expect(onChange).toHaveBeenCalledWith({
      enabledLinks: expect.any(Set),
    })
    expect(onChange.mock.calls[0][0].enabledLinks.size).toBe(1)
  })

  test('the slider emits the numeric value on change', () => {
    const onChange = vi.fn()
    render(<TraceFilterControls value={baseValue()} onChange={onChange} />)
    const slider = screen.getByTestId('depth-upstream') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith({ depthUpstream: 3 })
  })
})
