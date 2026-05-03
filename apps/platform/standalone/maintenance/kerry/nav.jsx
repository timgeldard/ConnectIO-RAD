// Left navigation + Top bar
const NAV_ITEMS = [
  { id: "overview",    label: "Control Tower",     icon: "dashboard", section: "Cockpit" },
  { id: "notif",       label: "Notifications",     icon: "bell",      section: "Work", badge: 41 },
  { id: "orders",      label: "Maintenance Orders",icon: "wrench",    section: "Work", badge: 1247 },
  { id: "backlog",     label: "Backlog & Planning",icon: "layers",    section: "Work" },
  { id: "reliability", label: "Reliability",       icon: "activity",  section: "Analytics" },
  { id: "assets",      label: "Asset Health",      icon: "chip",      section: "Analytics" },
  { id: "exceptions",  label: "Exceptions",        icon: "alert",     section: "Governance", badge: 91, badgeTone: "danger" },
];

const LeftNav = ({ active, onNav, collapsed }) => {
  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];
  return (
    <aside className="lnav">
      <div className="lnav-brand">
        <img src="kerry/assets/kerry-logo-white.png" alt="Kerry" />
        {!collapsed && (
          <div className="lnav-brand-stack">
            <span className="product-name">ConnectIO‑RAD</span>
            <span className="product">Plant Maintenance</span>
          </div>
        )}
      </div>
      <div className="lnav-list thin-scroll">
        {sections.map(s => (
          <React.Fragment key={s}>
            <div className="lnav-section">{s}</div>
            {NAV_ITEMS.filter(i => i.section === s).map(i => (
              <button key={i.id}
                className="lnav-item"
                aria-current={active === i.id ? "page" : undefined}
                onClick={() => onNav(i.id)}>
                <Icon name={i.icon} size={18} className="icon"/>
                <span className="label">{i.label}</span>
                {i.badge != null && (
                  <span className={"badge" + (i.badgeTone === "danger" ? " danger" : "")}>{i.badge}</span>
                )}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="lnav-footer">
        <div className="lnav-avatar">AB</div>
        {!collapsed && (
          <div className="lnav-user">
            <span className="name">Aoife Brennan</span>
            <span className="role">Maintenance Planner · BLT</span>
          </div>
        )}
      </div>
    </aside>
  );
};

const TopBar = ({ crumbs, onToggleNav, search, persona }) => {
  return (
    <div className="topbar">
      <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggleNav} title="Toggle navigation">
        <Icon name="menu" size={16}/>
      </button>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevR" size={12}/>}
            <span className={i === crumbs.length - 1 ? "crumb-current" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-spacer"/>
      <div className="topbar-search">
        <Icon name="search" size={14}/>
        <input placeholder="Search equipment, FLOC, notification, order…"/>
        <kbd>⌘K</kbd>
      </div>
      <button className="btn btn-ghost btn-icon btn-sm" title="Refresh"><Icon name="refresh" size={15}/></button>
      <button className="btn btn-ghost btn-icon btn-sm" title="Saved views"><Icon name="star" size={15}/></button>
      <Freshness asOf="2 min ago"/>
    </div>
  );
};

// Filter bar — used by most pages
const FilterBar = ({ filters, onChange, right, persona }) => {
  return (
    <div className="filterbar">
      <Select icon="building" value={filters.plant} placeholder="Plant"
        options={[{value:"BLT",label:"Beloit, WI"},{value:"ROC",label:"Rochester, NY"},{value:"NRW",label:"Naas, IE"}]}
        width={150}/>
      <Select icon="user" value={filters.planner} placeholder="Planner Group"
        options={[{value:"all",label:"All planner groups"},{value:"P-100",label:"A. Brennan"},{value:"P-101",label:"M. Holloway"}]}
        width={170}/>
      <Select icon="layout" value={filters.wc} placeholder="Work Center"
        options={[{value:"all",label:"All work centers"},{value:"MECH-A",label:"MECH-A"},{value:"ELEC",label:"ELEC"}]}
        width={170}/>
      <Select icon="calendar" value={filters.range} placeholder="Date"
        options={[{value:"7d",label:"Last 7 days"},{value:"30d",label:"Last 30 days"},{value:"90d",label:"Last 90 days"}]}
        width={140}/>
      <div style={{height: 22, width: 1, background: "var(--border-2)", margin: "0 4px"}}/>
      <Chip removable onRemove={() => {}}>Status: Released, In progress</Chip>
      <Chip removable onRemove={() => {}}>Priority: P1, P2</Chip>
      <span className="saved-view"><Icon name="star" size={12}/>My morning triage</span>
      <div style={{flex: 1}}/>
      {right}
      <button className="btn btn-ghost btn-sm"><Icon name="download" size={13}/>Export</button>
      <button className="btn btn-ghost btn-sm"><Icon name="share" size={13}/>Share</button>
    </div>
  );
};

window.LeftNav = LeftNav;
window.TopBar = TopBar;
window.FilterBar = FilterBar;
window.NAV_ITEMS = NAV_ITEMS;
