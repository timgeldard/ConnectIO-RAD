import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('renders the status as uppercase label by default', () => {
    render(<StatusPill status="ok" />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('renders a custom label when provided', () => {
    render(<StatusPill status="ok" label="Released" />)
    expect(screen.getByText('Released')).toBeInTheDocument()
  })

  it('applies ok chip class for pass-family statuses', () => {
    const { container } = render(<StatusPill status="pass" />)
    expect(container.firstChild).toHaveClass('chip-ok')
  })

  it('applies risk chip class for fail-family statuses', () => {
    const { container } = render(<StatusPill status="fail" />)
    expect(container.firstChild).toHaveClass('chip-risk')
  })

  it('applies warn chip class for warn status', () => {
    const { container } = render(<StatusPill status="warn" />)
    expect(container.firstChild).toHaveClass('chip-warn')
  })

  it('renders compact variant with reduced padding', () => {
    const { container } = render(<StatusPill status="ok" compact />)
    const el = container.firstChild as HTMLElement
    expect(el.style.fontSize).toBe('10px')
  })

  it('replaces underscores with spaces in default label', () => {
    render(<StatusPill status="out_of_control" />)
    expect(screen.getByText('OUT OF CONTROL')).toBeInTheDocument()
  })
})
