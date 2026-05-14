/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ZoneLayer from '../ZoneLayer'
import type { LayoutZone, RectangleGeometry } from '~/types'

const rectZone: LayoutZone = {
  zone_id: 'zone-1',
  plant_id: 'P225',
  floor_id: 'F1',
  zone_name: 'Zone 1',
  geometry_type: 'rectangle',
  geometry_json: { type: 'rectangle', x_pct: 10, y_pct: 20, width_pct: 30, height_pct: 25 } as RectangleGeometry,
  revision_id: 'rev-1',
  status: 'draft',
}

describe('ZoneLayer', () => {
  it('renders the zone-layer group', () => {
    render(
      <svg>
        <ZoneLayer zones={[]} selectedZoneId={null} onSelectZone={vi.fn()} dragRect={null} />
      </svg>,
    )
    expect(screen.getByTestId('zone-layer')).toBeInTheDocument()
  })

  it('renders a rect for a rectangle zone', () => {
    const { container } = render(
      <svg>
        <ZoneLayer zones={[rectZone]} selectedZoneId={null} onSelectZone={vi.fn()} dragRect={null} />
      </svg>,
    )
    const rect = container.querySelector('rect[data-zone-id="zone-1"]')
    expect(rect).toBeInTheDocument()
    expect(rect).toHaveAttribute('x', '10')
    expect(rect).toHaveAttribute('y', '20')
    expect(rect).toHaveAttribute('width', '30')
    expect(rect).toHaveAttribute('height', '25')
  })

  it('renders zone name as text', () => {
    render(
      <svg>
        <ZoneLayer zones={[rectZone]} selectedZoneId={null} onSelectZone={vi.fn()} dragRect={null} />
      </svg>,
    )
    expect(screen.getByText('Zone 1')).toBeInTheDocument()
  })

  it('calls onSelectZone with zone id when zone is clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <svg>
        <ZoneLayer zones={[rectZone]} selectedZoneId={null} onSelectZone={onSelect} dragRect={null} />
      </svg>,
    )
    const rect = container.querySelector('rect[data-zone-id="zone-1"]')!
    fireEvent.click(rect)
    expect(onSelect).toHaveBeenCalledWith('zone-1')
  })

  it('calls onSelectZone with null when already-selected zone is clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <svg>
        <ZoneLayer zones={[rectZone]} selectedZoneId="zone-1" onSelectZone={onSelect} dragRect={null} />
      </svg>,
    )
    const rect = container.querySelector('rect[data-zone-id="zone-1"]')!
    fireEvent.click(rect)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('renders drag-preview rect when dragRect is provided', () => {
    const dragRect: RectangleGeometry = { type: 'rectangle', x_pct: 5, y_pct: 5, width_pct: 20, height_pct: 15 }
    render(
      <svg>
        <ZoneLayer zones={[]} selectedZoneId={null} onSelectZone={vi.fn()} dragRect={dragRect} />
      </svg>,
    )
    expect(screen.getByTestId('drag-preview')).toBeInTheDocument()
  })

  it('does not render drag-preview when dragRect is null', () => {
    render(
      <svg>
        <ZoneLayer zones={[]} selectedZoneId={null} onSelectZone={vi.fn()} dragRect={null} />
      </svg>,
    )
    expect(screen.queryByTestId('drag-preview')).not.toBeInTheDocument()
  })
})
