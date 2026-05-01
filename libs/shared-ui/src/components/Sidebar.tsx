import { cloneElement, type ReactElement, type ReactNode, useState } from 'react'
import { Icon, type IconName } from './Icon'

export interface NavItem {
  id: string
  label: string
  icon: IconName
  accent?: boolean
  tag?: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export interface SidebarProps {
  brandLogo?: ReactNode
  brandName?: string
  appTag?: string
  groups: NavGroup[]
  activeId?: string
  onNavigate: (id: string) => void
  footer?: ReactNode
  roleIndicator?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Sidebar({
  brandLogo,
  brandName = 'Kerry',
  appTag,
  groups,
  activeId,
  onNavigate,
  footer,
  roleIndicator,
  className,
  style
}: SidebarProps) {
  return (
    <aside
      aria-label="Primary navigation"
      className={className}
      style={{
        width: 'var(--sidebar-w, 236px)',
        flexShrink: 0,
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--line-1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        ...style
      }}
    >
      {/* Brand */}
      <div style={{
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--line-1)',
        height: 'var(--header-h, 56px)',
        flexShrink: 0,
      }}>
        {brandLogo || (
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--valentia-slate)',
            letterSpacing: '-0.02em',
          }}>{brandName}</span>
        )}
        {appTag && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
          }}>{appTag}</span>
        )}
      </div>

      {/* Role indicator */}
      {roleIndicator && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--line-1)',
          flexShrink: 0,
        }}>
          {roleIndicator}
        </div>
      )}

      {/* Nav */}
      <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }} className="scroll">
        {groups.map((group, gIdx) => (
          <div key={gIdx} style={{ marginBottom: 16 }}>
            {group.label && (
              <div className="eyebrow" style={{ padding: '4px 10px 6px' }}>{group.label}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
              {group.items.map(item => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--line-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {footer}
        </div>
      )}
    </aside>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: active || hover ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text-1)' : 'var(--text-2)',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        width: '100%',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        position: 'relative',
        fontFamily: 'var(--font-sans)',
        transition: 'background 140ms, color 140ms',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          left: -12,
          top: 6,
          bottom: 6,
          width: 3,
          background: 'var(--valentia-slate)',
          borderRadius: 2,
        }} />
      )}
      <Icon name={item.icon} size={16} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.tag && (
        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          background: 'var(--innovation)',
          color: 'var(--forest)',
          borderRadius: 3,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>{item.tag}</span>
      )}
    </button>
  )
}
