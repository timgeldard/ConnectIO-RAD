import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import KPI from '../KPI'
import StatusPill from '../StatusPill'
import PersonaSwitcher from '../PersonaSwitcher'
import React from 'react'

describe('UI Core Components', () => {
  it('renders KPI with delta', () => {
    render(<KPI label="Test KPI" value={100} delta="5%" deltaDir="up" accent="ok" />)
    expect(screen.getByText('Test KPI')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText(/↑ 5%/i)).toBeInTheDocument()
  })

  it('renders StatusPill', () => {
    render(<StatusPill status="PASS" />)
    expect(screen.getByText(/Pass/i)).toBeInTheDocument()
  })

  it('PersonaSwitcher opens menu and calls onChange', async () => {
    const onChange = vi.fn()
    render(<PersonaSwitcher personaId="regional" onChange={onChange} />)
    
    // Initial state: menu closed
    expect(screen.queryByText(/Switch persona/i)).not.toBeInTheDocument()
    
    // Click to open
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/Switch persona/i)).toBeInTheDocument()
    
    // Click a persona
    fireEvent.click(screen.getByText(/Miguel Ortiz/i).closest('button')!)
    expect(onChange).toHaveBeenCalledWith('site')
  })
})
