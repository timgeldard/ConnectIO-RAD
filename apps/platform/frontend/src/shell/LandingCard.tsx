import type { ConnectIOModule } from '@connectio/shared-ui/shell'

/** Derives the navigation URL for a module, optionally landing on a specific tab view. */
export function moduleHref(mod: ConnectIOModule, activeTabId?: string): string {
  const tab = activeTabId ?? mod.defaultTab
  // Standalone apps have routeBase ending in '/'; navigate there directly.
  if (mod.routeBase.endsWith('/')) return mod.routeBase
  const base = `${mod.routeBase}/?module=${encodeURIComponent(mod.moduleId)}`
  return tab ? `${base}&tab=${encodeURIComponent(tab)}` : base
}

interface LandingCardProps {
  mod: ConnectIOModule
  /** The tab currently active in the shell SubNav — passed through to the Open link. */
  activeTabId?: string
}

/** Landing card shown in the content panel when a module is selected but not yet opened. */
export function LandingCard({ mod, activeTabId }: LandingCardProps) {
  const card = mod.landingCard
  if (!card) return null
  const href = moduleHref(mod, activeTabId)

  return (
    <div className="plat-landing" style={{ '--card-accent': mod.color } as React.CSSProperties}>
      <div className="plat-landing-bar" />
      <div className="plat-landing-body">
        <div className="plat-landing-tag">{card.tag}</div>
        <h1 className="plat-landing-name">{mod.displayName}</h1>
        <p className="plat-landing-desc">{card.desc}</p>

        <div className="plat-landing-stats">
          {card.stats.map((s) => (
            <div key={s.label} className="plat-stat">
              <span className={['plat-stat-val', s.tone ?? ''].filter(Boolean).join(' ')}>
                {s.value}
              </span>
              <span className="plat-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="plat-landing-actions">
          <a className="plat-btn-primary" href={href}>
            Open {mod.displayName} ↗
          </a>
        </div>
      </div>
    </div>
  )
}
