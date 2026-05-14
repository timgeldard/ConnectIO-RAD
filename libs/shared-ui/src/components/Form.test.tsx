import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Form } from './Form'

describe('Form', () => {
  it('renders children', () => {
    render(<Form><button type="submit">Submit</button></Form>)
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('calls onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn()
    render(<Form onSubmit={onSubmit}><button type="submit">Go</button></Form>)
    await userEvent.click(screen.getByRole('button'))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('prevents default form navigation on submit', async () => {
    const onSubmit = vi.fn()
    render(<Form onSubmit={onSubmit}><button type="submit">Go</button></Form>)
    await userEvent.click(screen.getByRole('button'))
    const event = onSubmit.mock.calls[0][0]
    expect(event.defaultPrevented).toBe(true)
  })

  it('renders as a form element', () => {
    const { container } = render(<Form><div /></Form>)
    expect(container.firstChild?.nodeName).toBe('FORM')
  })
})
