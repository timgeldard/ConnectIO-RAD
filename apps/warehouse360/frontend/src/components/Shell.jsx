import React from 'react';
import { Icon } from './Primitives.jsx';

/* Sidebar + Top bar */
const NAV = [
  { id: 'today', label: 'Control Tower', icon: 'dashboard', section: 'Today' },
  { id: 'staging', label: 'Production Staging', icon: 'factory', section: 'Operations', badge: '8', badgeTone: 'is-red' },
  { id: 'inbound', label: 'Inbound', icon: 'truckIn', section: 'Operations', badge: '3', badgeTone: 'is-amber' },
  { id: 'outbound', label: 'Outbound', icon: 'truckOut', section: 'Operations', badge: '5', badgeTone: 'is-red' },
  { id: 'inventory', label: 'Inventory & Bins', icon: 'boxes', section: 'Operations' },
  { id: 'dispensary', label: 'Dispensary', icon: 'scale', section: 'Operations' },
  { id: 'exceptions', label: 'Exceptions', icon: 'alert', section: 'Risk', badge: '44', badgeTone: 'is-slate' },
  { id: 'performance', label: 'Performance', icon: 'chart', section: 'Analytics' },
  { id: 'docs', label: 'Concept & Specs', icon: 'flag', section: 'Docs' },
];

const Sidebar = ({ current, onNav, shift }) => {
  let lastSection = null;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="assets/kerry-logo-white.png" alt="Kerry"/>
        <div className="sidebar-brand-label nav-label">Warehouse 360</div>
      </div>
      <div className="sidebar-site">
        <div>
          <div className="sidebar-site-name nav-label">Kerry Naas</div>
          <div className="sidebar-site-meta nav-label">IE01 · WH NS01 · {shift.id}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((n) => {
          const showSection = n.section !== lastSection;
          lastSection = n.section;
          return (
            <React.Fragment key={n.id}>
              {showSection && <div className="nav-section-label nav-label">{n.section}</div>}
              <button className={`nav-item ${current === n.id ? 'is-active' : ''}`} onClick={() => onNav(n.id)} title={n.label}>
                <Icon name={n.icon} size={18}/>
                <span className="nav-label">{n.label}</span>
                {n.badge && <span className={`nav-item-badge ${n.badgeTone || ''}`}>{n.badge}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">NM</div>
        <div className="nav-label" style={{ lineHeight: 1.2 }}>
          <div className="sidebar-user-name">Niamh Murphy</div>
          <div className="sidebar-user-role">Warehouse Manager</div>
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ title, subtitle, onSearch, onMobileNav }) => (
  <header className="topbar">
    <button className="icon-btn" onClick={onMobileNav} style={{ display: 'none' }} id="mobile-menu-btn">
      <Icon name="menu" size={20}/>
    </button>
    <div>
      <div className="topbar-title">{title}</div>
      {subtitle && <div className="topbar-sub">{subtitle}</div>}
    </div>
    <div className="topbar-spacer"/>
    <div className="topbar-search">
      <Icon name="search" size={15}/>
      <input placeholder="Search order, delivery, SSCC, material…" onChange={(e) => onSearch?.(e.target.value)}/>
      <span className="kbd">⌘K</span>
    </div>
    <button className="icon-btn" title="Refresh">
      <Icon name="refresh" size={18}/>
    </button>
    <button className="icon-btn" title="Notifications">
      <Icon name="bell" size={18}/>
      <span className="icon-btn-dot"/>
    </button>
    <button className="icon-btn" title="Settings">
      <Icon name="settings" size={18}/>
    </button>
  </header>
);

const MobileNav = ({ current, onNav }) => {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const primary = ['today', 'staging', 'outbound', 'exceptions'];
  const primaryItems = NAV.filter((n) => primary.includes(n.id));
  const secondaryItems = NAV.filter((n) => !primary.includes(n.id));
  const activeInSecondary = secondaryItems.some((n) => n.id === current);
  return (
    <>
      <nav className="mobile-nav">
        {primaryItems.map((n) => (
          <button key={n.id} className={`mobile-nav-item ${current === n.id ? 'is-active' : ''}`}
            onClick={() => { setMoreOpen(false); onNav(n.id); }}>
            <Icon name={n.icon} size={18}/>
            <span>{n.label.split(' ')[0]}</span>
            {n.badge && <span className={`mobile-nav-badge ${n.badgeTone || ''}`}>{n.badge}</span>}
          </button>
        ))}
        <button className={`mobile-nav-item ${activeInSecondary ? 'is-active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="menu" size={18}/>
          <span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}/>
          <div className="mobile-more-sheet">
            <div className="mobile-more-title">Navigate</div>
            {secondaryItems.map((n) => (
              <button key={n.id} className={`mobile-more-item ${current === n.id ? 'is-active' : ''}`}
                onClick={() => { setMoreOpen(false); onNav(n.id); }}>
                <Icon name={n.icon} size={16}/>
                <span>{n.label}</span>
                {n.badge && <span className={`nav-item-badge ${n.badgeTone || ''}`} style={{ marginLeft: 'auto' }}>{n.badge}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};


export { Sidebar, TopBar, MobileNav, NAV };
