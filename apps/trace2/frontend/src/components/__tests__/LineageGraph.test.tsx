import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LineageGraph } from '../LineageGraph'
import React from 'react'

describe('LineageGraph', () => {
  const mockFocal = { 
    id: 'F1', material_id: 'M1', batch_id: 'B1', material_name: 'Focal Mat', 
    batch_status: 'RELEASED', manufacture_date: '2024-01-01', plant_name: 'Plant 1',
    qty_produced: 1000, uom: 'KG'
  } as any
  
  const mockUpstream = [
    { id: 'U1', material_id: 'RM1', material: 'Raw Mat 1', batch: 'RB1', qty: 500, uom: 'KG', level: 1, link: 'CONSUMPTION', parent_id: 'F1' }
  ] as any

  it('renders focal and upstream nodes in SVG', () => {
    const { container } = render(
      <LineageGraph focal={mockFocal} upstream={mockUpstream} downstream={[]} />
    )
    
    // SVG and edges
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  })
})
