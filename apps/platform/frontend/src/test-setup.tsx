import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

vi.mock('@connectio/shared-frontend-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-frontend-i18n')>()
  const translations: Record<string, string> = {
    'platform.home.welcome': 'Welcome',
    'platform.home.welcomeBack': 'Welcome back, {{name}}',
    'platform.home.registeredApps': '{{count}} registered apps',
    'platform.home.domains': '{{count}} domains',
    'platform.home.searchLabel': 'Search apps',
    'platform.home.searchPlaceholder': 'Quality, SPC, trace, warehouse...',
    'platform.home.emptySearch': 'No registered apps match your search.',
    'platform.home.status.liveApi': 'Live API',
    'platform.home.status.static': 'Static',
  }
  const t = (key: string, values?: Record<string, string | number | boolean | null | undefined>) =>
    (translations[key] ?? key).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, valueKey: string) => {
      const value = values?.[valueKey]
      return value === null || value === undefined ? '' : String(value)
    })
  return {
    ...actual,
    useI18n: () => ({
      language: 'en' as const,
      languages: [{ code: 'en' as const, label: 'English', nativeLabel: 'English', enabled: true }],
      setLanguage: vi.fn(),
      t,
      formatNumber: (v: number) => String(v),
      formatDate: (v: Date | string | number) => String(v),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock('@connectio/shared-app-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-app-context')>()
  let selectedId = ''
  return {
    ...actual,
    usePlantSelection: () => ({
      plants: [{ plant_id: 'P1', plant_name: 'Plant 1' }],
      selectedPlantId: selectedId,
      selectedPlant: selectedId === 'P1' ? { plant_id: 'P1', plant_name: 'Plant 1' } : null,
      setSelectedPlantId: vi.fn((id) => { selectedId = id }),
      loading: false,
      error: null,
    }),
    PlantProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
