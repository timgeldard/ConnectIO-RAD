import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import KPI from '../KPI'
import StatusPill from '../StatusPill'
import PersonaSwitcher from '../PersonaSwitcher'

describe('UI Core Components', () => {
  it('renders KPI with delta', () => {
    render(<KPI label="Test KPI" value={100} delta="5%" deltaDir="up" accent="ok" />)
    expect(screen.getByText('Test KPI')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText(/↑ 5%/i)).toBeInTheDocument()
  })

  it('renders StatusPill with translated status key', () => {
    // The mock t() returns the key, so PASS renders as 'envmon.status.PASS'
    render(<StatusPill status="PASS" />)
    expect(screen.getByText('envmon.status.PASS')).toBeInTheDocument()
  })

  it('StatusPill respects explicit label override', () => {
    render(<StatusPill status="PASS" label="Custom" />)
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('PersonaSwitcher opens menu and calls onChange', async () => {
    const onChange = vi.fn()
    render(<PersonaSwitcher personaId="regional" onChange={onChange} />)

    // Initial state: menu closed — translated key not rendered
    expect(screen.queryByText('envmon.persona.switchLabel')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('envmon.persona.switchLabel')).toBeInTheDocument()

    // Click a persona
    fireEvent.click(screen.getByText(/Miguel Ortiz/i).closest('button')!)
    expect(onChange).toHaveBeenCalledWith('site')
  })
})
