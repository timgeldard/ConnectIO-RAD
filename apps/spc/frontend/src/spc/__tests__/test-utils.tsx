import { render, type RenderOptions } from '@testing-library/react'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import type { ReactElement } from 'react'
import resources from '../../../i18n/resources.json'

/**
 * Renders a component wrapped in an I18nProvider with English forced.
 *
 * Using `availableLanguages={['en']}` prevents `detectInitialLanguage` from
 * picking up jsdom's `navigator.language`, which can vary across CI environments.
 * `localStorage.clear()` removes any previously persisted language selection.
 */
export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  localStorage.clear()
  return render(
    <I18nProvider appName="spc" resources={resources} availableLanguages={['en']}>
      {ui}
    </I18nProvider>,
    options,
  )
}
