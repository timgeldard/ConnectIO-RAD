import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Field } from './Field'

describe('Field', () => {
  it('renders the label', () => {
    render(<Field label="Material ID"><input /></Field>)
    expect(screen.getByText('Material ID')).toBeInTheDocument()
  })

  it('links label to input via htmlFor', () => {
    render(<Field label="Material ID" htmlFor="mat"><input id="mat" /></Field>)
    expect(screen.getByLabelText('Material ID')).toBeInTheDocument()
  })

  it('renders required asterisk when required', () => {
    render(<Field label="Batch" required><input /></Field>)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('does not render asterisk when not required', () => {
    render(<Field label="Batch"><input /></Field>)
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('renders error message with alert role', () => {
    render(<Field label="Batch" error="Not found"><input /></Field>)
    expect(screen.getByRole('alert')).toHaveTextContent('Not found')
  })

  it('renders help text when no error', () => {
    render(<Field label="Batch" help="Enter the batch number"><input /></Field>)
    expect(screen.getByText('Enter the batch number')).toBeInTheDocument()
  })

  it('suppresses help text when error is shown', () => {
    render(<Field label="Batch" help="Enter the batch number" error="Invalid"><input /></Field>)
    expect(screen.queryByText('Enter the batch number')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
