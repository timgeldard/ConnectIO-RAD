import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { I18nProvider, useI18n, type LanguageCode } from '@connectio/shared-frontend-i18n'
import type { LangCode, Strings } from './dictionary'
import enResources from './locales/en.json'

const loadResource = async (lang: LanguageCode) => {
  return (await import(`./locales/${lang}.json`)).default
}

interface LangContextValue {
  lang: LangCode
  t: Strings
  setLang: (next: LangCode) => void
}

const fallback: LangContextValue = {
  lang: 'en',
  t: enResources as unknown as Strings,
  setLang: () => {},
}

export const LangContext = createContext<LangContextValue>(fallback)

/**
 * Mirrors the prototype's `useT()` accessor. Returns `{ lang, t, setLang }`
 * where `t` is a flat object of strings for the current language.
 */
export function useT(): LangContextValue {
  return useContext(LangContext)
}

function LangContextBridge({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useI18n()

  const value = useMemo<LangContextValue>(() => {
    // This is a bit of a hack to keep the t.key access working:
    // we create a proxy that delegates to the shared t() function.
    const proxyT = new Proxy({} as any, {
      get: (_, key: string) => t(`poh.${key}`),
    })

    return {
      lang: language as LangCode,
      setLang: (next: LangCode) => setLanguage(next as LanguageCode),
      t: proxyT as Strings,
    }
  }, [language, setLanguage, t])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

interface LangProviderProps {
  children: ReactNode
}

export function LangProvider({ children }: LangProviderProps) {
  return (
    <I18nProvider
      appName="processorderhistory"
      resources={{ en: enResources }}
      loadResource={loadResource}
    >
      <LangContextBridge>{children}</LangContextBridge>
    </I18nProvider>
  )
}
