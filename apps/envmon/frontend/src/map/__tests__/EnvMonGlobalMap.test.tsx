/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EnvMonGlobalMap from '../EnvMonGlobalMap'

// Mock maplibregl
vi.mock('maplibre-gl', () => {
  const Map = vi.fn()
  Map.prototype.addControl = vi.fn()
  Map.prototype.on = vi.fn()
  Map.prototype.once = vi.fn()
  Map.prototype.remove = vi.fn()
  Map.prototype.setStyle = vi.fn()
  Map.prototype.addSource = vi.fn()
  Map.prototype.addLayer = vi.fn()
  Map.prototype.getStyle = vi.fn(() => ({ glyphs: 'mock-glyphs' }))
  Map.prototype.getCanvas = vi.fn(() => ({ style: {} }))
  Map.prototype.getZoom = vi.fn(() => 6)
  Map.prototype.dragRotate = { disable: vi.fn() }
  Map.prototype.touchZoomRotate = { disableRotation: vi.fn() }
  Map.prototype.getSource = vi.fn()
  Map.prototype.isStyleLoaded = vi.fn(() => true)
  Map.prototype.getLayer = vi.fn(() => ({}))
  Map.prototype.setFilter = vi.fn()
  Map.prototype.flyTo = vi.fn()
  Map.prototype.easeTo = vi.fn()
  Map.prototype.fitBounds = vi.fn()

  return {
    default: {
      Map,
      NavigationControl: vi.fn(),
    },
    Map,
    NavigationControl: vi.fn(),
  }
})

describe('EnvMonGlobalMap', () => {
  const mockFC = {
    type: 'FeatureCollection',
    features: []
  }
  const mockPlants = [
    { plant_id: 'P1', lat: 10, lon: 20, kpis: { active_fails: 0, pass_rate: 100 } }
  ]

  it('renders without crashing', () => {
    render(
      <EnvMonGlobalMap 
        featureCollection={mockFC as any} 
        plants={mockPlants as any} 
        selectedPlantId={null} 
        onOpenPlant={vi.fn()} 
      />
    )
    expect(document.querySelector('.envmon-map-container')).toBeDefined()
  })

  it('shows badge when no locations have GPS', () => {
    const plantsNoGPS = [{ plant_id: 'P1', lat: 0, lon: 0 }]
    render(
      <EnvMonGlobalMap 
        featureCollection={mockFC as any} 
        plants={plantsNoGPS as any} 
        selectedPlantId={null} 
        onOpenPlant={vi.fn()} 
      />
    )
    expect(screen.getByText(/No GPS coordinates/i)).toBeDefined()
  })
})
