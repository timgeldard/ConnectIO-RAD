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
      /** Passthrough: returns the key with any interpolation values appended for easy assertion. */
      t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => {
        if (!values) return key
        return Object.entries(values).reduce(
          (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v ?? '')),
          key,
        )
      },
      formatNumber: (v: number) => String(v),
      formatDate: (v: Date | string | number) => String(v),
    }),
    LanguageSelector: () => null,
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
