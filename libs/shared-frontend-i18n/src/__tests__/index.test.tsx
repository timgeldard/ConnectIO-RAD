/* eslint-disable jsdoc/require-jsdoc */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, describe, vi } from 'vitest'
import {
  I18nProvider,
  useI18n,
  LanguageSelector,
} from '../index'

// A small component to consume useI18n
function TestComponent() {
  const { language, t, formatNumber, formatDate } = useI18n()
  return (
    <div>
      <div data-testid="lang">{language}</div>
      <div data-testid="t1">{t('hello')}</div>
      <div data-testid="t2">{t('greeting', { name: 'Alice' })}</div>
      <div data-testid="num">{formatNumber(1234.5)}</div>
      <div data-testid="date">{formatDate(new Date('2026-05-09T00:00:00Z'))}</div>
    </div>
  )
}

describe('I18nProvider and useI18n', () => {
  test('throws if useI18n is used outside of provider', () => {
    // Suppress console.error for expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestComponent />)).toThrow('useI18n must be used inside I18nProvider')
    spy.mockRestore()
  })

  test('provides default language and translates keys', () => {
    const resources = {
      en: {
        hello: 'Hello',
        greeting: 'Hello, {{name}}!',
      },
    }

    render(
      <I18nProvider appName="test" resources={resources}>
        <TestComponent />
      </I18nProvider>
    )

    expect(screen.getByTestId('lang')).toHaveTextContent('en')
    expect(screen.getByTestId('t1')).toHaveTextContent('Hello')
    expect(screen.getByTestId('t2')).toHaveTextContent('Hello, Alice!')
  })

  test('supports changing language via LanguageSelector', async () => {
    const user = userEvent.setup()
    const resources = {
      en: { hello: 'Hello', 'shared.language.label': 'Language' },
      fr: { hello: 'Bonjour', 'shared.language.label': 'Langue' },
    }

    render(
      <I18nProvider appName="test" resources={resources}>
        <LanguageSelector />
        <TestComponent />
      </I18nProvider>
    )

    expect(screen.getByTestId('t1')).toHaveTextContent('Hello')

    const select = screen.getByRole('combobox')
    await act(async () => {
      await user.selectOptions(select, 'fr')
    })

    expect(screen.getByTestId('lang')).toHaveTextContent('fr')
    expect(screen.getByTestId('t1')).toHaveTextContent('Bonjour')
  })

  test('loads remote resources', async () => {
    const loadResource = vi.fn().mockResolvedValue({ hello: 'Guten Tag' })
    window.localStorage.setItem('connectio:test2:language', 'de')

    render(
      <I18nProvider appName="test2" defaultLanguage="de" availableLanguages={['de']} loadResource={loadResource}>
        <TestComponent />
      </I18nProvider>
    )

    expect(screen.getByTestId('lang')).toHaveTextContent('de')
    expect(loadResource).toHaveBeenCalledWith('de')

    // Wait for the async load to settle
    await screen.findByText('Guten Tag')
  })
})
