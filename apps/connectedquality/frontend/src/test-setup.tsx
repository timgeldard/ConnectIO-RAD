import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

vi.mock('@connectio/shared-frontend-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-frontend-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      language: 'en' as const,
      languages: [{ code: 'en' as const, label: 'English', nativeLabel: 'English', enabled: true }],
      setLanguage: vi.fn(),
      t: (key: string) => key,
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
