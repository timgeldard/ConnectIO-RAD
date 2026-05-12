import { useState, useEffect } from 'react'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { MODULES } from './modules'
import { moduleHref } from './LandingCard'
import {
  groupModulesByCategory,
  moduleSearchText,
  type PlatformModuleRegistration,
} from './moduleManifest'

interface HomePanelProps {
  /** Modules currently visible to the platform user after registry filtering. */
  modules?: ConnectIOModule[]
  /** Friendly user name already loaded by the shell session hook. */
  sessionName?: string
  /** Enables the standalone fallback session lookup when no parent session is provided. */
  fetchSessionFallback?: boolean
}

const categoryLabel = (category: string): string =>
  category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const moduleStatus = (mod: PlatformModuleRegistration, t: (key: string) => string): string => {
  if (mod.health?.badge) return mod.health.badge
  if (mod.health?.status && mod.health.status !== 'unknown') return mod.health.status
  return mod.backendPrefix ? t('platform.home.status.liveApi') : t('platform.home.status.static')
}

/**
 * Renders the platform home dashboard for registered manufacturing apps.
 *
 * @returns Searchable, grouped app launch cards with shell status metadata.
 */
export function HomePanel({
  modules = MODULES,
  sessionName,
  fetchSessionFallback = true,
}: HomePanelProps) {
  const { t } = useI18n()
  const [name, setName] = useState(sessionName ?? '')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (sessionName) {
      setName(sessionName)
      return
    }
    if (!fetchSessionFallback) {
      setName('')
      return
    }
    fetch('/api/platform/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setName(data.name)
      })
      .catch(() => {})
  }, [fetchSessionFallback, sessionName])

  const normalizedQuery = query.trim().toLowerCase()
  const cards = (modules as PlatformModuleRegistration[])
    .filter((m) => m.isUserSelectable && m.landingCard)
    .filter((m) => !normalizedQuery || moduleSearchText(m).includes(normalizedQuery))
  const groups = [...groupModulesByCategory(cards).entries()].sort(([a], [b]) => {
    if (a === 'demo') return 1
    if (b === 'demo') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="plat-home">
      <div className="plat-home-hero">
        <div>
          <h1 className="plat-home-greeting">
            {name ? t('platform.home.welcomeBack', { name }) : t('platform.home.welcome')}
          </h1>
          <div className="plat-home-summary">
            <span>{t('platform.home.registeredApps', { count: cards.length })}</span>
            <span>{t('platform.home.domains', { count: groups.length })}</span>
          </div>
        </div>
        <label className="plat-home-search">
          <span>{t('platform.home.searchLabel')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('platform.home.searchPlaceholder')}
          />
        </label>
      </div>
      {groups.map(([category, categoryModules]) => (
        <section key={category} className="plat-home-section">
          <div className="plat-home-section-head">
            <h2>{categoryLabel(category)}</h2>
            <span>{categoryModules.length}</span>
          </div>
          <div className="plat-home-grid">
            {categoryModules.map((mod) => (
              <a
                key={mod.moduleId}
                className="plat-home-card"
                href={moduleHref(mod)}
                style={{ '--card-accent': mod.color } as React.CSSProperties}
              >
                <div className="plat-home-card-bar" />
                <div className="plat-home-card-body">
                  <div className="plat-home-card-meta">
                    <div className="plat-landing-tag">{mod.landingCard!.tag}</div>
                    <span className="plat-home-status">{moduleStatus(mod, t)}</span>
                  </div>
                  <div className="plat-home-card-name">{mod.displayName}</div>
                  <p className="plat-home-card-desc">{mod.landingCard!.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      {cards.length === 0 ? <div className="plat-empty">{t('platform.home.emptySearch')}</div> : null}
    </div>
  )
}
