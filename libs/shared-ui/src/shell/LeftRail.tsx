import { useState, useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'
import type { ConnectIOModule, SidebarBottomItem } from './types'

interface LeftRailProps {
  modules: ConnectIOModule[]
  activeModule: string
  onPick: (moduleId: string) => void
  bottomItems: SidebarBottomItem[]
  /** Runtime badge counts keyed by moduleId e.g. { alarms: 7 } */
  badgeMap?: Record<string, number>
  onBottomItemClick?: (item: SidebarBottomItem) => void
  /** Called when the user clicks the × button to remove a module from the rail. */
  onModuleUnpin?: (moduleId: string) => void
  /** Modules the user has hidden — shown in the "Add module" picker. */
  hiddenModules?: ConnectIOModule[]
  /** Called when the user pins a hidden module back to the rail. */
  onModulePin?: (moduleId: string) => void
}

/** Fixed 56px left navigation rail driven by the app manifest. */
export function LeftRail({
  modules,
  activeModule,
  onPick,
  bottomItems,
  badgeMap,
  onBottomItemClick,
  onModuleUnpin,
  hiddenModules = [],
  onModulePin,
}: LeftRailProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        addBtnRef.current && !addBtnRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  return (
    <aside className="connectio-rail">
      <div className="connectio-rail-logo" title="Kerry">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <text x="13" y="19" textAnchor="middle" fontFamily="serif" fontWeight="bold" fontSize="20" fill="white">K</text>
        </svg>
      </div>

      {modules.map((m) => {
        const badge = badgeMap?.[m.moduleId]
        const canUnpin = m.isUserSelectable && !m.isMandatory && !!onModuleUnpin
        return (
          <button
            key={m.moduleId}
            className={'connectio-rail-mod' + (activeModule === m.moduleId ? ' active' : '')}
            onClick={() => onPick(m.moduleId)}
            title={m.displayName}
          >
            <Icon name={m.icon as never} size={20} />
            <span>{m.shortName}</span>
            {badge != null && <span className="badge">{badge}</span>}
            {canUnpin && (
              <span
                className="rail-unpin"
                role="button"
                aria-label={`Remove ${m.displayName} from sidebar`}
                onClick={(e) => { e.stopPropagation(); onModuleUnpin!(m.moduleId) }}
              >
                <Icon name="x" size={9} />
              </span>
            )}
          </button>
        )
      })}

      {hiddenModules.length > 0 && (
        <>
          <button
            ref={addBtnRef}
            className={'connectio-rail-add' + (pickerOpen ? ' open' : '')}
            title="Add module to sidebar"
            onClick={() => setPickerOpen((p) => !p)}
            aria-expanded={pickerOpen}
          >
            <Icon name="plus" size={14} />
          </button>
          {pickerOpen && (
            <div ref={pickerRef} className="connectio-rail-picker">
              <p className="connectio-rail-picker-title">ADD MODULE</p>
              {hiddenModules.map((m) => (
                <button
                  key={m.moduleId}
                  className="connectio-rail-picker-item"
                  onClick={() => { onModulePin?.(m.moduleId); setPickerOpen(false) }}
                >
                  <Icon name={m.icon as never} size={14} />
                  <span>{m.displayName}</span>
                  <Icon name="plus" size={12} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="connectio-rail-spacer" />
      <div className="connectio-rail-foot">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            title={item.tooltip}
            onClick={() => onBottomItemClick?.(item)}
          >
            <Icon name={item.icon as never} size={16} />
          </button>
        ))}
      </div>
    </aside>
  )
}
