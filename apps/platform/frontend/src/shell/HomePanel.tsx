import { useState, useEffect } from 'react'
import { MODULES } from './modules'
import { moduleHref } from './LandingCard'

export function HomePanel() {
  const [name, setName] = useState('')

  useEffect(() => {
    fetch('/api/platform/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setName(data.name)
      })
      .catch(() => {})
  }, [])

  const cards = MODULES.filter((m) => m.isUserSelectable && m.landingCard)

  return (
    <div className="plat-home">
      <h1 className="plat-home-greeting">
        {name ? `Welcome back, ${name}` : 'Welcome'}
      </h1>
      <div className="plat-home-grid">
        {cards.map((mod) => (
          <a
            key={mod.moduleId}
            className="plat-home-card"
            href={moduleHref(mod)}
            style={{ '--card-accent': mod.color } as React.CSSProperties}
          >
            <div className="plat-home-card-bar" />
            <div className="plat-home-card-body">
              <div className="plat-landing-tag">{mod.landingCard!.tag}</div>
              <div className="plat-home-card-name">{mod.displayName}</div>
              <p className="plat-home-card-desc">{mod.landingCard!.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
