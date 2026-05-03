/* === App shell — top bar + side nav === */

const NAV_ITEMS = [
  { section: "EXECUTE" },
  { id: "queue",     label: "Operator Queue",      icon: "queue",     badge: 6, persona: "Operator" },
  { id: "exec",      label: "Execution Workspace", icon: "play",      persona: "Operator" },
  { id: "material",  label: "Material & Yield",    icon: "package",   persona: "Operator" },
  { id: "ipqc",      label: "In-Process Quality",  icon: "flask",     persona: "Operator" },
  { id: "batch",     label: "Batch & Genealogy",   icon: "stack",     persona: "Operator" },
  { id: "exceptions",label: "Exceptions & Holds",  icon: "alert",     badge: 3 },
  { section: "OVERSEE" },
  { id: "monitor",   label: "Work Center Monitor", icon: "monitor",   persona: "Supervisor" },
  { id: "ebr",       label: "Batch Record Review", icon: "book",      badge: 2, persona: "QA" },
  { id: "analytics", label: "Execution Analytics", icon: "chart" },
];

const Shell = ({ active, setActive, children, crumbs }) => {
  const item = NAV_ITEMS.find(n => n.id === active);
  const persona = item?.persona || "Operator";
  return (
    <div className="app">
      <div className="app__topbar">
        <div className="app__brand">
          <img src="kerry/kerry-k-icon.png" alt="Kerry" />
          <div className="app__brand-text">
            CONNECTIO·RAD
            <span>Process Execution</span>
          </div>
        </div>
        <div className="app__crumbs">
          <span>Beloit, WI</span>
          <span className="sep"><Icon name="chevronRight" size={12}/></span>
          <span>Shift B</span>
          <span className="sep"><Icon name="chevronRight" size={12}/></span>
          <strong>{crumbs || item?.label}</strong>
        </div>
        <div className="app__top-actions">
          <div className="app__search">
            <Icon name="search" size={14}/>
            <input placeholder="Search order, batch, material, phase…" />
            <span className="mono" style={{fontSize:11,color:"var(--pec-ink-soft)"}}>⌘K</span>
          </div>
          <button className="app__icon-btn" title="Notifications">
            <Icon name="bell" size={18}/>
            <span className="dot"></span>
          </button>
          <div className="app__user">
            <div className="avatar">MC</div>
            <div className="meta">
              <span className="name">Mei Chen</span>
              <span className="role">{persona}</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="app__nav">
        {NAV_ITEMS.map((n, i) => n.section ? (
          <div key={i} className="app__nav-section">{n.section}</div>
        ) : (
          <button key={n.id} className={`nav-item ${active === n.id ? "is-active" : ""}`} onClick={() => setActive(n.id)} title={n.label}>
            <Icon name={n.icon} size={18}/>
            <span className="nav-label">{n.label}</span>
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </button>
        ))}
        <div style={{flex:1}}></div>
        <button className="nav-item" title="Settings">
          <Icon name="settings" size={18}/>
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      <main className="app__main">{children}</main>
    </div>
  );
};

window.Shell = Shell;
window.NAV_ITEMS = NAV_ITEMS;
