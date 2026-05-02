import { Icon } from '../components/Icon'

interface ShellTopBarProps {
  /** Product name displayed in impact type e.g. 'CONNECTEDQUALITY'. */
  appName: string
  /** Secondary tagline e.g. 'A KERRY PLATFORM · UAT'. */
  tagline: string
  breadcrumb: string[]
  onAlarms: () => void
  /** Initials shown in the user avatar e.g. 'SK'. */
  userInitials?: string
  /** User display name e.g. 'Sarah Keane'. */
  userName?: string
  /** User role/location e.g. 'QA · Charleville'. */
  userRole?: string
}

/** 48px top bar — product name, breadcrumb, alarm bell, and user widget. */
export function ShellTopBar({
  appName,
  tagline,
  breadcrumb,
  onAlarms,
  userInitials = '--',
  userName = '',
  userRole = '',
}: ShellTopBarProps) {
  return (
    <header className="connectio-topbar">
      <div className="connectio-product">
        <span>{appName}</span>
        <span className="dot" />
        <span className="sub">{tagline}</span>
      </div>
      <div style={{ width: 1, height: 22, background: 'var(--shell-line)' }} />
      <div className="connectio-bc">
        {breadcrumb.map((b, i) => (
          <span key={i} className={i === breadcrumb.length - 1 ? 'here' : ''}>
            {i > 0 && <span className="sep" style={{ marginRight: 6 }}>/</span>}
            {b}
          </span>
        ))}
      </div>
      <div className="connectio-topbar-right">
        <button className="connectio-icon-btn" title="Search">
          <Icon name="search" />
        </button>
        <button className="connectio-icon-btn" title="Alarms" onClick={onAlarms}>
          <Icon name="bell" />
          <span className="ping" />
        </button>
        <button className="connectio-icon-btn" title="Settings">
          <Icon name="settings" />
        </button>
        <div className="connectio-user">
          <div className="av">{userInitials}</div>
          {userName && (
            <div>
              <div className="name">{userName}</div>
              {userRole && <div className="role">{userRole}</div>}
            </div>
          )}
          <Icon name="chevron-right" size={14} />
        </div>
      </div>
    </header>
  )
}
