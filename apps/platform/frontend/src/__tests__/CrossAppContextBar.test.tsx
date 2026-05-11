/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CrossAppContextBar } from '../shell/CrossAppContextBar'

describe('CrossAppContextBar', () => {
  it('renders process order context', () => {
    const ctx = {
      entity: 'processOrder' as const,
      processOrderId: 'PO123',
      from: 'spc'
    }
    const onClear = vi.fn()
    render(<CrossAppContextBar ctx={ctx} onClear={onClear} />)
    
    expect(screen.getByText(/Process Order PO123/)).toBeDefined()
    expect(screen.getByText(/SPC/)).toBeDefined()
    
    fireEvent.click(screen.getByText(/Clear context/))
    expect(onClear).toHaveBeenCalled()
  })

  it('renders pour analytics context', () => {
    const ctx = {
      entity: 'pourAnalytics' as const,
      from: 'unknown'
    }
    render(<CrossAppContextBar ctx={ctx} onClear={() => {}} />)
    expect(screen.getByText(/Pour Analytics/)).toBeDefined()
    expect(screen.getByText(/unknown/)).toBeDefined()
  })

  it('renders generic context', () => {
    const ctx = {
      entity: 'batch' as any,
      from: undefined
    }
    render(<CrossAppContextBar ctx={ctx} onClear={() => {}} />)
    expect(screen.getByText(/batch/)).toBeDefined()
    expect(screen.getByText(/another module/)).toBeDefined()
  })
})
