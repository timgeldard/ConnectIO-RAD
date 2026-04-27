import React from 'react'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Ensure RTL cleans up the DOM after each test
afterEach(() => {
  cleanup()
})

// maplibre-gl initializes a Web Worker via URL.createObjectURL at import time,
// which jsdom doesn't implement. Stub the surface area we use so the
// CustomerMap module can import cleanly during tests.
vi.mock('maplibre-gl', () => {
  class FakeMap {
    on = vi.fn()
    off = vi.fn()
    once = vi.fn()
    addControl = vi.fn()
    addSource = vi.fn()
    addLayer = vi.fn()
    getSource = vi.fn()
    getLayer = vi.fn()
    setStyle = vi.fn()
    setFilter = vi.fn()
    flyTo = vi.fn()
    fitBounds = vi.fn()
    easeTo = vi.fn()
    remove = vi.fn()
    isStyleLoaded = vi.fn(() => true)
    getZoom = vi.fn(() => 1.5)
    getCanvas = vi.fn(() => ({ style: {} as CSSStyleDeclaration }))
    getStyle = vi.fn(() => ({ glyphs: undefined }))
    queryRenderedFeatures = vi.fn(() => [])
    project = vi.fn(() => ({ x: 0, y: 0 }))
    dragRotate = { disable: vi.fn() }
    touchZoomRotate = { disableRotation: vi.fn() }
  }
  class FakeMarker {
    setLngLat = vi.fn(() => this)
    setPopup = vi.fn(() => this)
    addTo = vi.fn(() => this)
    remove = vi.fn(() => this)
  }
  class FakePopup {
    setDOMContent = vi.fn(() => this)
    setHTML = vi.fn(() => this)
  }
  class FakeLngLatBounds {
    extend = vi.fn(() => this)
  }
  class FakeNavigationControl {}
  return {
    default: {
      Map: FakeMap,
      Marker: FakeMarker,
      Popup: FakePopup,
      LngLatBounds: FakeLngLatBounds,
      NavigationControl: FakeNavigationControl,
    },
    Map: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    LngLatBounds: FakeLngLatBounds,
    NavigationControl: FakeNavigationControl,
  }
})

vi.mock('@connectio/shared-frontend-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-frontend-i18n')>()
  const resources = await import('./i18n/resources.json')
  const interpolate = (text: string, values?: Record<string, string | number | boolean | null | undefined>) => {
    if (!values) return text
    return Object.entries(values).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value ?? '')),
      text,
    )
  }

  return {
    ...actual,
    useI18n: () => ({
      language: 'en' as const,
      languages: [{ code: 'en' as const, label: 'English', nativeLabel: 'English', enabled: true }],
      setLanguage: vi.fn(),
      t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) =>
        interpolate((resources.default as Record<string, Record<string, string>>).en[key] ?? key, values),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en', options).format(value),
      formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', options).format(new Date(value)),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
