import type { ReactNode } from 'react'
import type { Tab } from '~/constants'

interface SubNavProps {
  tabs: Tab[]
  active: string
  onPick: (id: string) => void
  right?: ReactNode
}

/** Module sub-navigation tab bar, sticky at the top of the body area. */
export function SubNav({ tabs, active, onPick, right }: SubNavProps) {
  return (
    <div className="cq-subnav">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={'tab' + (active === t.id ? ' active' : '')}
          onClick={() => onPick(t.id)}
        >
          <span className="num">{t.num}</span>
          <span>{t.label}</span>
          {t.pip && <span className="pip" />}
        </button>
      ))}
      <div className="cq-subnav-spacer" />
      <div className="right">{right}</div>
    </div>
  )
}
