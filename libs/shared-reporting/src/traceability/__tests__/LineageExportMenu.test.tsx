import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LineageExportMenu } from '../LineageExportMenu'

describe('LineageExportMenu', () => {
  test('renders nothing when neither handler is provided', () => {
    const { container } = render(<LineageExportMenu />)
    expect(container.firstChild).toBeNull()
  })

  test('renders the toggle when at least one handler is provided', () => {
    render(<LineageExportMenu onPng={async () => {}} />)
    expect(screen.getByTestId('lineage-export-menu-toggle')).toBeTruthy()
  })

  test('opens the menu on click and shows only the handlers configured', async () => {
    render(<LineageExportMenu onPng={async () => {}} />)
    await userEvent.click(screen.getByTestId('lineage-export-menu-toggle'))
    expect(screen.getByTestId('lineage-export-png')).toBeTruthy()
    expect(screen.queryByTestId('lineage-export-svg')).toBeNull()
  })

  test('dispatches the PNG handler when its menu item is clicked', async () => {
    const onPng = vi.fn().mockResolvedValue(undefined)
    render(<LineageExportMenu onPng={onPng} />)
    await userEvent.click(screen.getByTestId('lineage-export-menu-toggle'))
    await userEvent.click(screen.getByTestId('lineage-export-png'))
    expect(onPng).toHaveBeenCalledTimes(1)
  })

  test('shows a busy label while the handler is in flight', async () => {
    let resolve: () => void = () => {}
    const onPng = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    render(<LineageExportMenu onPng={onPng} />)
    await userEvent.click(screen.getByTestId('lineage-export-menu-toggle'))
    await userEvent.click(screen.getByTestId('lineage-export-png'))
    expect(screen.getByTestId('lineage-export-menu-toggle').textContent).toMatch(/Saving PNG/i)
    resolve()
    await waitFor(() => {
      expect(screen.getByTestId('lineage-export-menu-toggle').textContent).not.toMatch(/Saving/i)
    })
  })

  test('handler failure clears the busy state and logs to console', async () => {
    const err = new Error('boom')
    const onPng = vi.fn().mockRejectedValue(err)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<LineageExportMenu onPng={onPng} />)
    await userEvent.click(screen.getByTestId('lineage-export-menu-toggle'))
    await userEvent.click(screen.getByTestId('lineage-export-png'))
    await waitFor(() => {
      expect(screen.getByTestId('lineage-export-menu-toggle').textContent).not.toMatch(/Saving/i)
    })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
