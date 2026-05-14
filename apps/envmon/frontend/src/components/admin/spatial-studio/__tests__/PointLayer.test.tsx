/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PointLayer from '../PointLayer'
import type { LocationMeta, LayoutZone, RectangleGeometry } from '~/types'

const mappedCoord: LocationMeta = {
  func_loc_id: 'LOC-1',
  func_loc_name: 'Location 1',
  plant_id: 'P225',
  floor_id: 'F1',
  x_pos: 50,
  y_pos: 50,
  is_mapped: true,
  parent_zone_id: null,
}

const unmappedCoord: LocationMeta = {
  func_loc_id: 'LOC-2',
  func_loc_name: 'Location 2',
  plant_id: 'P225',
  floor_id: 'F1',
  x_pos: null,
  y_pos: null,
  is_mapped: false,
  parent_zone_id: null,
}

const rectangleZone: LayoutZone = {
  zone_id: 'zone-1',
  plant_id: 'P225',
  floor_id: 'F1',
  zone_name: 'Zone 1',
  geometry_type: 'rectangle',
  geometry_json: { type: 'rectangle', x_pct: 30, y_pct: 30, width_pct: 40, height_pct: 40 } as RectangleGeometry,
  revision_id: 'rev-1',
  status: 'draft',
}

describe('PointLayer', () => {
  it('renders the point-layer group', () => {
    render(
      <svg>
        <PointLayer coordinates={[]} zones={[]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    expect(screen.getByTestId('point-layer')).toBeInTheDocument()
  })

  it('renders a circle for a mapped coordinate', () => {
    const { container } = render(
      <svg>
        <PointLayer coordinates={[mappedCoord]} zones={[]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    const circle = container.querySelector('circle[data-point-id="LOC-1"]')
    expect(circle).toBeInTheDocument()
    expect(circle).toHaveAttribute('cx', '50')
    expect(circle).toHaveAttribute('cy', '50')
  })

  it('does not render a circle for an unmapped coordinate', () => {
    const { container } = render(
      <svg>
        <PointLayer coordinates={[unmappedCoord]} zones={[]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    expect(container.querySelector('circle[data-point-id="LOC-2"]')).not.toBeInTheDocument()
  })

  it('calls onSelectPoint with id when an unselected point is clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <svg>
        <PointLayer coordinates={[mappedCoord]} zones={[]} selectedPointId={null} onSelectPoint={onSelect} />
      </svg>,
    )
    fireEvent.click(container.querySelector('circle[data-point-id="LOC-1"]')!)
    expect(onSelect).toHaveBeenCalledWith('LOC-1')
  })

  it('calls onSelectPoint with null when the selected point is clicked again', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <svg>
        <PointLayer coordinates={[mappedCoord]} zones={[]} selectedPointId="LOC-1" onSelectPoint={onSelect} />
      </svg>,
    )
    fireEvent.click(container.querySelector('circle[data-point-id="LOC-1"]')!)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('applies red stroke when coordinate is outside parent zone', () => {
    const outsideCoord: LocationMeta = { ...mappedCoord, x_pos: 5, y_pos: 5, parent_zone_id: 'zone-1' }
    const { container } = render(
      <svg>
        <PointLayer coordinates={[outsideCoord]} zones={[rectangleZone]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    const circle = container.querySelector('circle[data-point-id="LOC-1"]')!
    expect(circle.getAttribute('stroke')).toBe('#e55')
  })

  it('does not apply red stroke when coordinate is inside parent zone', () => {
    const insideCoord: LocationMeta = { ...mappedCoord, x_pos: 50, y_pos: 50, parent_zone_id: 'zone-1' }
    const { container } = render(
      <svg>
        <PointLayer coordinates={[insideCoord]} zones={[rectangleZone]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    const circle = container.querySelector('circle[data-point-id="LOC-1"]')!
    expect(circle.getAttribute('stroke')).not.toBe('#e55')
  })

  it('does not apply red stroke when parent_zone_id is null', () => {
    const { container } = render(
      <svg>
        <PointLayer coordinates={[mappedCoord]} zones={[rectangleZone]} selectedPointId={null} onSelectPoint={vi.fn()} />
      </svg>,
    )
    const circle = container.querySelector('circle[data-point-id="LOC-1"]')!
    expect(circle.getAttribute('stroke')).not.toBe('#e55')
  })
})
