import { MODULES, type ModuleId } from '~/constants'
import { Icon } from '~/components/Icon'

interface LeftRailProps {
  active: ModuleId
  onPick: (id: ModuleId) => void
}

/** Fixed 56px left navigation rail with module buttons and utility footer. */
export function LeftRail({ active, onPick }: LeftRailProps) {
  return (
    <aside className="cq-rail">
      <div className="cq-rail-logo" title="Kerry">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <text x="13" y="19" textAnchor="middle" fontFamily="serif" fontWeight="bold" fontSize="20" fill="white">K</text>
        </svg>
      </div>
      {MODULES.map((m) => (
        <button
          key={m.id}
          className={'cq-rail-mod' + (active === m.id ? ' active' : '')}
          onClick={() => onPick(m.id)}
          title={m.label}
        >
          <Icon name={m.icon} size={20} />
          <span>{m.label}</span>
          {m.badge != null && <span className="badge">{m.badge}</span>}
        </button>
      ))}
      <div className="cq-rail-spacer" />
      <div className="cq-rail-foot">
        <button title="Help"><Icon name="help" size={16} /></button>
        <button title="User"><Icon name="user" size={16} /></button>
      </div>
    </aside>
  )
}
