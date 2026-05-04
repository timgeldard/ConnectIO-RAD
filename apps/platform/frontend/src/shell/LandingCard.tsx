import type { ConnectIOModule } from '@connectio/shared-ui/shell'

/** Derives the navigation URL for a module. Standalone apps have routeBase ending in '/'. */
export function moduleHref(mod: ConnectIOModule): string {
  if (mod.routeBase.endsWith('/')) return mod.routeBase
  return `${mod.routeBase}/?module=${encodeURIComponent(mod.moduleId)}`
}

interface LandingCardProps {
  mod: ConnectIOModule
}

/** Landing card shown in the content panel when a module is selected but not yet opened. */
export function LandingCard({ mod }: LandingCardProps) {
  const card = mod.landingCard
  if (!card) return null
  const href = moduleHref(mod)

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
