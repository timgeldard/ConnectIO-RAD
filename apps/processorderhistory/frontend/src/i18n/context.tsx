import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STRINGS, type LangCode, type Strings } from './dictionary'

interface LangContextValue {
  lang: LangCode
  t: Strings
  setLang: (next: LangCode) => void
}

const STORAGE_KEY = 'kerry-poh-lang'
const DEFAULT_LANG: LangCode = 'en'

const fallback: LangContextValue = {
  lang: DEFAULT_LANG,
  t: STRINGS[DEFAULT_LANG] as Strings,
  setLang: () => {},
}

export const LangContext = createContext<LangContextValue>(fallback)

/**
 * Mirrors the prototype's `useT()` accessor. Returns `{ lang, t, setLang }`
 * where `t` is a flat object of strings for the current language. Components
 * authored against the prototype API (`t.statusRunning`, `t.navOrders`) work
 * verbatim; cross-monorepo tooling (e.g. `validate_i18n.py`) is satisfied via
 * the parallel `resources.json` rendered from the same dictionary.
 */
export function useT(): LangContextValue {
  return useContext(LangContext)
}

interface LangProviderProps {
  children: ReactNode
}

export function LangProvider({ children }: LangProviderProps) {
  const [lang, setLangState] = useState<LangCode>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANG
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as LangCode | null
      return saved && saved in STRINGS ? saved : DEFAULT_LANG
    } catch {
      return DEFAULT_LANG
    }
  })

  const setLang = (next: LangCode) => {
    if (!(next in STRINGS)) return
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LangContextValue>(
    () => ({ lang, t: STRINGS[lang] as Strings, setLang }),
    [lang],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
