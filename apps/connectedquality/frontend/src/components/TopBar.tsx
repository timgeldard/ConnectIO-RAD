import { Icon } from '~/components/Icon'

interface TopBarProps {
  breadcrumb: string[]
  onAlarms: () => void
}

/** 48px top bar — product name, breadcrumb, and utility buttons. */
export function TopBar({ breadcrumb, onAlarms }: TopBarProps) {
  return (
    <header className="cq-topbar">
      <div className="cq-product">
        <span>
          CONNECTED<span style={{ color: 'var(--cq-accent)' }}>QUALITY</span>
        </span>
        <span className="dot" />
        <span className="sub">A KERRY PLATFORM · UAT</span>
      </div>
      <div style={{ width: 1, height: 22, background: 'var(--cq-line)' }} />
      <div className="cq-bc">
        {breadcrumb.map((b, i) => (
          <span key={i} className={i === breadcrumb.length - 1 ? 'here' : ''}>
            {i > 0 && <span className="sep" style={{ marginRight: 6 }}>/</span>}
            {b}
          </span>
        ))}
      </div>
      <div className="cq-topbar-right">
        <button className="cq-icon-btn" title="Search"><Icon name="search" /></button>
        <button className="cq-icon-btn" title="Alarms" onClick={onAlarms}>
          <Icon name="bell" />
          <span className="ping" />
        </button>
        <button className="cq-icon-btn" title="Settings"><Icon name="settings" /></button>
        <div className="cq-user">
          <div className="av">SK</div>
          <div>
            <div className="name">Sarah Keane</div>
            <div className="role">QA · Charleville</div>
          </div>
          <Icon name="chev" size={14} />
        </div>
      </div>
    </header>
  )
}
