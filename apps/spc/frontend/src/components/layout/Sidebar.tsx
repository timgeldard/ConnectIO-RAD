import { useI18n } from '@connectio/shared-frontend-i18n'
import { Icon } from '@connectio/shared-ui'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../../spc/SPCContext'
import type { SPCTabId } from '../../spc/types'

interface NavItem {
  id: string
  labelKey: string
  icon: string
  accent?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'overview',  labelKey: 'spc.nav.overview',  icon: 'home'       },
  { id: 'flow',      labelKey: 'spc.nav.flow',      icon: 'git-branch' },
  { id: 'charts',    labelKey: 'spc.nav.charts',    icon: 'activity'   },
  { id: 'scorecard', labelKey: 'spc.nav.scorecard', icon: 'layout'     },
]

const ADVANCED_NAV: NavItem[] = [
  { id: 'compare',      labelKey: 'spc.nav.compare',      icon: 'bar-chart' },
  { id: 'msa',          labelKey: 'spc.nav.msa',          icon: 'target'    },
  { id: 'correlation',  labelKey: 'spc.nav.correlation',  icon: 'grid'      },
  { id: 'multivariate', labelKey: 'spc.nav.multivariate', icon: 'layers'    },
  { id: 'genie',        labelKey: 'spc.nav.genie',        icon: 'sparkles', accent: true },
]

interface SidebarProps {
  dark?: boolean
}

export function Sidebar({ dark = false }: SidebarProps) {
  const { t } = useI18n()
  const dispatch = useSPCDispatch()
  const { activeTab, roleMode } = useSPCSelector(
    s => ({ activeTab: s.activeTab, roleMode: s.roleMode }),
    shallowEqual,
  )

  return (
    <aside
      aria-label="Primary navigation"
      style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--line-1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      {/* Brand */}
      <div style={{
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--line-1)',
        height: 'var(--header-h)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--valentia-slate)',
          letterSpacing: '-0.02em',
        }}>Kerry</span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--text-3)',
          textTransform: 'uppercase',
        }}>SPC</span>
      </div>

      {/* Role indicator */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--line-1)',
        flexShrink: 0,
      }}>
        <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{t('spc.role.label')}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-ok" />
          {roleMode === 'operator' ? t('spc.role.operator') : t('spc.role.analyst')}
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }} className="scroll">
        <div className="eyebrow" style={{ padding: '4px 10px 6px' }}>{t('spc.nav.primary')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
          {PRIMARY_NAV.map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeTab === item.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: item.id as SPCTabId })}
            />
          ))}
        </div>

        {roleMode !== 'operator' && (
          <>
            <div className="eyebrow" style={{ padding: '16px 10px 6px' }}>{t('spc.nav.advanced')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
              {ADVANCED_NAV.map(item => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeTab === item.id}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: item.id as Parameters<typeof dispatch>[0] extends { type: 'SET_ACTIVE_TAB'; payload: infer P } ? P : never })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* User footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--line-1)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: 'var(--sage)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 11,
          flexShrink: 0,
        }}>
          QA
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.3, minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('spc.workspace')}
          </div>
          <div style={{ color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {roleMode === 'operator' ? t('spc.view.operator') : t('spc.view.analyst')}
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label="Switch role"
          onClick={() => dispatch({ type: 'SET_ROLE_MODE', payload: roleMode === 'engineer' ? 'operator' : 'engineer' })}
          style={{ marginLeft: 'auto' }}
        >
          <Icon name="users" size={14} />
        </button>
      </div>
    </aside>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: active ? 'var(--surface-2)' : 'transparent',
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
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
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
      <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
      {item.accent && (
        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          background: 'var(--innovation)',
          color: 'var(--forest)',
          borderRadius: 3,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>AI</span>
      )}
    </button>
  )
}
