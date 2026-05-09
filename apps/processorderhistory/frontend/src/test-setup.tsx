import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

vi.mock('@connectio/shared-frontend-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-frontend-i18n')>()
  const resources = await import('./i18n/locales/en.json')
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
        interpolate((resources.default as Record<string, string>)[key] ?? key, values),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en', options).format(value),
      formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', options).format(new Date(value)),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock('@connectio/shared-app-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-app-context')>()
  return {
    ...actual,
    usePlantSelection: () => ({
      plants: [{ plant_id: 'P1', plant_name: 'Plant 1' }],
      selectedPlantId: 'P1',
      selectedPlant: { plant_id: 'P1', plant_name: 'Plant 1' },
      setSelectedPlantId: vi.fn(),
      loading: false,
      error: null,
    }),
    PlantProvider: ({ children }: { children: React.ReactNode }) => children,
    PlantContextBar: () => null,
  }
})
