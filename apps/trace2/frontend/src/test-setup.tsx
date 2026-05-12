/* eslint-disable jsdoc/require-jsdoc */
import React from 'react'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Ensure RTL cleans up the DOM after each test
afterEach(() => {
  cleanup()
})

// vitest 4.x's jsdom environment ships with a `--localstorage-file`
// flag that, when unset, leaves `window.localStorage` as a stub without
// the standard Storage methods.  Install a deterministic in-memory
// Storage so production code paths that read/write localStorage (page
// preferences, mode toggles) work in tests.
if (typeof window !== 'undefined') {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() { return store.size },
    clear: () => { store.clear() },
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
    key: (i) => Array.from(store.keys())[i] ?? null,
  }
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  Object.defineProperty(window, 'sessionStorage', { value: storage, configurable: true })
}

// cytoscape touches the DOM/Web APIs as soon as it constructs a Core. Stub
// the surface area we use so the trace2 lineage pages can mount in jsdom.
vi.mock('cytoscape', () => {
  const mkCollection = () => ({
    remove: vi.fn(),
    removeClass: vi.fn(),
    addClass: vi.fn(),
    nonempty: vi.fn(() => false),
    forEach: vi.fn(),
    source: () => ({ id: () => '' }),
    target: () => ({ id: () => '' }),
    id: () => '',
    data: vi.fn(),
  })
  const fakeCy = {
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    add: vi.fn(),
    elements: vi.fn(() => mkCollection()),
    edges: vi.fn(() => mkCollection()),
    nodes: vi.fn(() => mkCollection()),
    getElementById: vi.fn(() => mkCollection()),
    layout: vi.fn(() => ({ run: vi.fn() })),
    destroy: vi.fn(),
  }
  const fn = vi.fn(() => fakeCy) as unknown as { (): unknown; use: ReturnType<typeof vi.fn> }
  fn.use = vi.fn()
  return { default: fn }
})

vi.mock('cytoscape-cose-bilkent', () => ({ default: vi.fn() }))

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
  const enResources = await import('./i18n/locales/en.json')
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
        interpolate((enResources.default as Record<string, string>)[key] ?? key, values),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en', options).format(value),
      formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', options).format(new Date(value)),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock('@connectio/shared-app-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-app-context')>()
  let selectedId = ''
  const mockContext = {
    plants: [{ plant_id: 'P1', plant_name: 'Plant 1' }],
    selectedPlantId: selectedId,
    selectedPlant: selectedId === 'P1' ? { plant_id: 'P1', plant_name: 'Plant 1' } : null,
    setSelectedPlantId: vi.fn((id) => { selectedId = id }),
    loading: false,
    error: null,
  }
  return {
    ...actual,
    usePlantSelection: () => mockContext,
    PlantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PlantContextBar: () => <div data-testid="plant-context-bar" />,
  }
})
