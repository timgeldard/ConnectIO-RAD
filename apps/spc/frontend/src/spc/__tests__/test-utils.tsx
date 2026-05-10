import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import type { ReactElement } from 'react'
import enResources from '../../i18n/locales/en.json'

/**
 * Renders a component wrapped in an I18nProvider with English forced.
 *
 * Using `availableLanguages={['en']}` prevents `detectInitialLanguage` from
 * picking up jsdom's `navigator.language`, which can vary across CI environments.
 * `localStorage.clear()` removes any previously persisted language selection.
 */
export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  // Clear any previously persisted language. Guard against Node ≥22 environments where
  // the global localStorage does not expose .clear() (jsdom/Node native storage mismatch).
  try { localStorage.clear() } catch { /* environment doesn't support Storage.clear() */ }
  return render(
    <I18nProvider appName="spc" resources={{ en: enResources }} availableLanguages={['en']}>
      {ui}
    </I18nProvider>,
    options,
  )
}

/** Renders with I18nProvider + a fresh QueryClientProvider for integration tests that use real hooks. */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  try { localStorage.clear() } catch { /* environment doesn't support Storage.clear() */ }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider appName="spc" resources={{ en: enResources }} availableLanguages={['en']}>
        {ui}
      </I18nProvider>
    </QueryClientProvider>,
    options,
  )
}
