import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EnvMonGlobalMap from '../EnvMonGlobalMap'

// Mock maplibregl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      addControl: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      remove: vi.fn(),
      setStyle: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getStyle: vi.fn(() => ({ glyphs: 'mock-glyphs' })),
      getCanvas: vi.fn(() => ({ style: {} })),
      getZoom: vi.fn(() => 6),
      dragRotate: { disable: vi.fn() },
      touchZoomRotate: { disableRotation: vi.fn() },
      getSource: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
      getLayer: vi.fn(() => ({})),
      setFilter: vi.fn(),
      flyTo: vi.fn(),
      easeTo: vi.fn(),
      fitBounds: vi.fn(),
    })),
    NavigationControl: vi.fn(),
  }
}))

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
    expect(document.querySelector('.envmon-map-container')).toBeInTheDocument()
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
    expect(screen.getByText(/No GPS coordinates/i)).toBeInTheDocument()
  })
})
