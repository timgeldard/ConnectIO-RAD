import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ControlTower } from '../ControlTower'

describe('ControlTower', () => {
  it('renders greeting and title', () => {
    render(<ControlTower />)
    expect(screen.getByText(/Good morning, Niamh/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Orders at risk/i).length).toBeGreaterThan(0)
  })
})
