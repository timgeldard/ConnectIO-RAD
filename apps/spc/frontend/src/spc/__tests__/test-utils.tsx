import { render, type RenderOptions } from '@testing-library/react'
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
