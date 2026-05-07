import { useState, useEffect } from 'react'
import { MODULES } from './modules'

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName
}

interface HomePanelProps {
  onModuleChange: (moduleId: string) => void
}

export function HomePanel({ onModuleChange }: HomePanelProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setName(firstName(data.name))
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
          <button
            key={mod.moduleId}
            className="plat-home-card"
            style={{ '--card-accent': mod.color } as React.CSSProperties}
            onClick={() => onModuleChange(mod.moduleId)}
          >
            <div className="plat-home-card-bar" />
            <div className="plat-home-card-body">
              <div className="plat-landing-tag">{mod.landingCard!.tag}</div>
              <div className="plat-home-card-name">{mod.displayName}</div>
              <p className="plat-home-card-desc">{mod.landingCard!.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
