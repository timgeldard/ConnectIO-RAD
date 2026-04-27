import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

/**
 * Global mock for the shared i18n library.
 * Returns a passthrough `t` function so component tests do not need an
 * I18nProvider wrapper, while still exercising all JSX paths.
 */
vi.mock('@connectio/shared-frontend-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@connectio/shared-frontend-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      language: 'en' as const,
      languages: [{ code: 'en' as const, label: 'English', nativeLabel: 'English', enabled: true }],
      setLanguage: vi.fn(),
      /** Lightweight test translations for accessibility-sensitive strings, with key fallback. */
      t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => {
        const translations: Record<string, string> = {
          'envmon.floorPlan.markersAria': 'Heatmap markers for floor {{floor}}',
          'envmon.floorPlan.alt': 'Floor plan for {{floor}}',
          'envmon.floorPlan.loading': 'Loading...',
          'envmon.floorPlan.error': 'Failed to load heatmap:',
        }
        const template = translations[key] ?? key
        if (!values) return template
        return Object.entries(values).reduce(
          (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v ?? '')),
          template,
        )
      },
      formatNumber: (v: number) => String(v),
      formatDate: (v: Date | string | number) => String(v),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
