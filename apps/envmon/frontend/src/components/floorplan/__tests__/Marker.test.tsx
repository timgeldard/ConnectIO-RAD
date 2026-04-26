import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Marker from '../Marker'
import React from 'react'

describe('Marker', () => {
  const mockMarker = { func_loc_id: 'L1', x_pos: 10, y_pos: 20, status: 'PASS', risk_score: null } as any
  const onClick = vi.fn()

  it('renders SVG group and circle', () => {
    const { container } = render(
      <svg>
        <Marker 
          marker={mockMarker} 
          mode="deterministic" 
          svgWidth={1000} 
          svgHeight={700} 
          onClick={onClick}
          onMouseEnter={vi.fn()}
          onMouseLeave={vi.fn()}
        />
      </svg>
    )
    expect(container.querySelector('.em-marker--pass')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    render(
      <svg>
        <Marker 
          marker={mockMarker} 
          mode="deterministic" 
          svgWidth={1000} 
          svgHeight={700} 
          onClick={onClick}
          onMouseEnter={vi.fn()}
          onMouseLeave={vi.fn()}
        />
      </svg>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith(mockMarker)
  })
})
