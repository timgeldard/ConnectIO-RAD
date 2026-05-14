/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PublishDialog from '../PublishDialog'

const defaultProps = {
  isOpen: true,
  isPending: false,
  reason: '',
  onReasonChange: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('PublishDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<PublishDialog {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the dialog when open', () => {
    render(<PublishDialog {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Publish layout')).toBeInTheDocument()
  })

  it('contains the verbatim historical-impact warning', () => {
    render(<PublishDialog {...defaultProps} />)
    expect(screen.getByText(/Publishing this layout will affect how current and historical EnvMon results are/)).toBeInTheDocument()
    expect(screen.getByText(/Inspection result values are unchanged; only their spatial interpretation may change\./)).toBeInTheDocument()
  })

  it('disables confirm when reason is empty', () => {
    render(<PublishDialog {...defaultProps} reason="" />)
    expect(screen.getByTestId('publish-confirm-btn')).toBeDisabled()
  })

  it('disables confirm when reason is whitespace only', () => {
    render(<PublishDialog {...defaultProps} reason="   " />)
    expect(screen.getByTestId('publish-confirm-btn')).toBeDisabled()
  })

  it('enables confirm when reason has content', () => {
    render(<PublishDialog {...defaultProps} reason="Added zone for area A" />)
    expect(screen.getByTestId('publish-confirm-btn')).not.toBeDisabled()
  })

  it('disables confirm while isPending', () => {
    render(<PublishDialog {...defaultProps} reason="Valid reason" isPending={true} />)
    expect(screen.getByTestId('publish-confirm-btn')).toBeDisabled()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<PublishDialog {...defaultProps} reason="Valid reason" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('publish-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<PublishDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onReasonChange when textarea value changes', () => {
    const onReasonChange = vi.fn()
    render(<PublishDialog {...defaultProps} onReasonChange={onReasonChange} />)
    fireEvent.change(screen.getByTestId('publish-reason-input'), { target: { value: 'New reason' } })
    expect(onReasonChange).toHaveBeenCalledWith('New reason')
  })
})
