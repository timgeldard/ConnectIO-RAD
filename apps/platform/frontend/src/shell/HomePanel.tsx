import { useState, useEffect } from 'react'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { MODULES } from './modules'
import { moduleHref } from './LandingCard'
import {
  groupModulesByCategory,
  moduleSearchText,
  type PlatformModuleRegistration,
} from './moduleManifest'

interface HomePanelProps {
  modules?: ConnectIOModule[]
  sessionName?: string
}

const categoryLabel = (category: string): string =>
  category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const moduleStatus = (mod: PlatformModuleRegistration): string => {
  if (mod.health?.badge) return mod.health.badge
  if (mod.health?.status && mod.health.status !== 'unknown') return mod.health.status
  return mod.backendPrefix ? 'Live API' : 'Static'
}

export function HomePanel({ modules = MODULES, sessionName }: HomePanelProps) {
  const [name, setName] = useState(sessionName ?? '')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (sessionName) {
      setName(sessionName)
      return
    }
    fetch('/api/platform/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setName(data.name)
      })
      .catch(() => {})
  }, [sessionName])

  const normalizedQuery = query.trim().toLowerCase()
  const cards = (modules as PlatformModuleRegistration[])
    .filter((m) => m.isUserSelectable && m.landingCard)
    .filter((m) => !normalizedQuery || moduleSearchText(m).includes(normalizedQuery))
  const groups = [...groupModulesByCategory(cards).entries()]

  return (
    <div className="plat-home">
      <div className="plat-home-hero">
        <div>
          <h1 className="plat-home-greeting">
            {name ? `Welcome back, ${name}` : 'Welcome'}
          </h1>
          <div className="plat-home-summary">
            <span>{cards.length} registered apps</span>
            <span>{groups.length} domains</span>
          </div>
        </div>
        <label className="plat-home-search">
          <span>Search apps</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Quality, SPC, trace, warehouse..."
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
                    <span className="plat-home-status">{moduleStatus(mod)}</span>
                  </div>
                  <div className="plat-home-card-name">{mod.displayName}</div>
                  <p className="plat-home-card-desc">{mod.landingCard!.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      {cards.length === 0 ? <div className="plat-empty">No registered apps match your search.</div> : null}
    </div>
  )
}
