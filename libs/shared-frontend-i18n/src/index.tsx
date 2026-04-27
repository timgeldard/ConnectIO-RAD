import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'

export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'zh' | 'pt' | 'id' | 'ms'
export type TranslationValues = Record<string, string | number | boolean | null | undefined>
export type LocaleResources = Partial<Record<LanguageCode, Record<string, string>>>

export interface LanguageOption {
  code: LanguageCode
  label: string
  nativeLabel: string
  enabled: boolean
}

export const supportedLanguages: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', enabled: true },
  { code: 'fr', label: 'French', nativeLabel: 'Français', enabled: true },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', enabled: true },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', enabled: true },
  { code: 'zh', label: 'Mandarin', nativeLabel: '中文', enabled: false },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', enabled: false },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', enabled: false },
  { code: 'ms', label: 'Malay', nativeLabel: 'Bahasa Melayu', enabled: false },
]

const DEFAULT_LANGUAGE: LanguageCode = 'en'
const INTERPOLATION_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

interface I18nContextValue {
  language: LanguageCode
  languages: LanguageOption[]
  setLanguage: (language: LanguageCode) => void
  t: (key: string, values?: TranslationValues) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function normalizeLanguage(language: string | undefined, available: LanguageCode[]): LanguageCode {
  const raw = (language ?? '').toLowerCase()
  const exact = available.find(code => code.toLowerCase() === raw)
  if (exact) return exact
  const base = raw.split('-', 1)[0]
  return available.find(code => code === base) ?? DEFAULT_LANGUAGE
}

function detectInitialLanguage(storageKey: string, available: LanguageCode[]): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) return normalizeLanguage(saved, available)
  } catch {
    // Storage access can be blocked; language detection should still render.
  }
  return normalizeLanguage(window.navigator.language, available)
}

function interpolate(text: string, values?: TranslationValues): string {
  if (!values) return text
  return text.replace(INTERPOLATION_RE, (_match, key: string) => {
    const value = values[key]
    return value === null || value === undefined ? '' : String(value)
  })
}

interface I18nProviderProps {
  appName: string
  resources: LocaleResources
  children: ReactNode
  defaultLanguage?: LanguageCode
  availableLanguages?: LanguageCode[]
}

export function I18nProvider({
  appName,
  resources,
  children,
  defaultLanguage = DEFAULT_LANGUAGE,
  availableLanguages = ['en', 'fr', 'es', 'de'],
}: I18nProviderProps) {
  const parentContext = useContext(I18nContext)
  const available = availableLanguages.includes(defaultLanguage)
    ? availableLanguages
    : [defaultLanguage, ...availableLanguages]
  const storageKey = `connectio:${appName}:language`
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage(storageKey, available))

  const enabledLanguages = useMemo(
    () => supportedLanguages.filter(option => available.includes(option.code)).map(option => ({ ...option, enabled: true })),
    [available.join('|')],
  )

  const setLanguage = useCallback((next: LanguageCode) => {
    const normalized = available.includes(next) ? next : defaultLanguage
    setLanguageState(normalized)
    try {
      window.localStorage.setItem(storageKey, normalized)
    } catch {
      // Persistence is a convenience, not a rendering requirement.
    }
  }, [available.join('|'), defaultLanguage, storageKey])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const t = useCallback((key: string, values?: TranslationValues) => {
    const selected = resources[language]?.[key]
    const fallback = resources[defaultLanguage]?.[key]
    return interpolate(selected ?? fallback ?? key, values)
  }, [defaultLanguage, language, resources])

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(language, options).format(value),
    [language],
  )

  const formatDate = useCallback((value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    const date = value instanceof Date ? value : new Date(value)
    return new Intl.DateTimeFormat(language, options).format(date)
  }, [language])

  const contextValue = useMemo<I18nContextValue>(() => ({
    language,
    languages: enabledLanguages,
    setLanguage,
    t,
    formatNumber,
    formatDate,
  }), [enabledLanguages, formatDate, formatNumber, language, setLanguage, t])

  return <I18nContext.Provider value={parentContext ?? contextValue}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return value
}

interface LanguageSelectorProps {
  compact?: boolean
  label?: string
}

export function LanguageSelector({ compact = false, label }: LanguageSelectorProps) {
  const { language, languages, setLanguage, t } = useI18n()
  const accessibleLabel = label ?? t('shared.language.label')

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value as LanguageCode)
  }

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: compact ? 11 : 12,
        color: 'currentColor',
        whiteSpace: 'nowrap',
      }}
    >
      {!compact && <span>{accessibleLabel}</span>}
      <select
        aria-label={accessibleLabel}
        value={language}
        onChange={handleChange}
        style={{
          minWidth: compact ? 74 : 132,
          height: compact ? 28 : 32,
          borderRadius: 6,
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'currentColor',
          font: 'inherit',
          padding: '0 8px',
        }}
      >
        {languages.map(option => (
          <option key={option.code} value={option.code}>
            {compact ? option.code.toUpperCase() : option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
