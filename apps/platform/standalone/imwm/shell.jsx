// shell.jsx — App shell: nav, topbar, context bar, theming, persona, tweaks

const { Icon, Sparkline } = window.UI;

const MODULES = [
  { id: "overview",   label: "Control Tower",       icon: "dashboard",  group: "main",   badge: null },
  { id: "im",         label: "IM Inventory",        icon: "database",   group: "main",   badge: null },
  { id: "wm",         label: "WM Warehouse",        icon: "warehouse",  group: "main",   badge: null },
  { id: "recon",      label: "Reconciliation",      icon: "scale",      group: "action", badge: { kind: "warning", v: 28 } },
  { id: "exceptions", label: "Exceptions",          icon: "alert",      group: "action", badge: { kind: "danger", v: 12 } },
  { id: "analytics",  label: "Analytics & Insights", icon: "trending",   group: "main",   badge: null },
  { id: "spec",       label: "Design Spec",         icon: "fileText",   group: "doc",    badge: null },
];

const PERSONAS = [
  { id: "analyst",  name: "Aoife Brennan",   role: "Inventory Analyst",  initials: "AB", default: "im" },
  { id: "manager",  name: "Sean Murphy",     role: "Warehouse Manager",  initials: "SM", default: "wm" },
  { id: "exec",     label: "executive", name: "Priya Devi",  role: "Supply Chain Lead",  initials: "PD", default: "overview" },
];

function NavItem({ active, icon, label, badge, onClick }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon name={icon}/>
      <span className="nav-label">{label}</span>
      {badge && <span className={`nav-badge ${badge.kind === "danger" ? "" : "muted"}`}>{badge.v}</span>}
    </button>
  );
}

function Nav({ current, onNav, collapsed, onToggleCollapsed }) {
  const main = MODULES.filter(m => m.group === "main");
  const action = MODULES.filter(m => m.group === "action");
  const doc = MODULES.filter(m => m.group === "doc");
  return (
    <aside className="nav">
      <div className="nav-brand">
        <div className="nav-brand-mark">K</div>
        <div className="nav-brand-text">
          <span className="l1">Warehouse360</span>
          <span className="l2">ConnectIO · RAD</span>
        </div>
      </div>

      <div className="nav-section">
        <div className="nav-section-h">Inventory</div>
        {main.map(m => <NavItem key={m.id} active={current===m.id} icon={m.icon} label={m.label} badge={m.badge} onClick={() => onNav(m.id)}/>)}
      </div>

      <div className="nav-section">
        <div className="nav-section-h">Workflows</div>
        {action.map(m => <NavItem key={m.id} active={current===m.id} icon={m.icon} label={m.label} badge={m.badge} onClick={() => onNav(m.id)}/>)}
      </div>

      <div className="nav-section">
        <div className="nav-section-h">Reference</div>
        {doc.map(m => <NavItem key={m.id} active={current===m.id} icon={m.icon} label={m.label} badge={m.badge} onClick={() => onNav(m.id)}/>)}
      </div>

      <div className="nav-foot">
        <NavItem icon="settings" label="Settings" onClick={() => {}}/>
        <NavItem icon="panelLeft" label={collapsed ? "Expand" : "Collapse"} onClick={onToggleCollapsed}/>
      </div>
    </aside>
  );
}

function PersonaPill({ persona, onChange }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="persona-pill" onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1, gap: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{persona.name}</span>
          <span className="role">{persona.role}</span>
        </div>
        <div className="avatar">{persona.initials}</div>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 38, right: 0, zIndex: 30,
          background: "var(--c-surface)", border: "1px solid var(--c-stroke)",
          borderRadius: 8, padding: 6, minWidth: 220,
          boxShadow: "var(--shadow-md)"
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--c-fg-mute)", padding: "6px 10px" }}>Switch persona</div>
          {PERSONAS.map(p => (
            <button key={p.id} className="nav-item" style={{ color: "var(--c-fg)", padding: "8px 10px" }}
                    onClick={() => { onChange(p); setOpen(false); }}>
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 11, background: persona.id === p.id ? "var(--c-brand)" : "var(--c-surface-sunk)", color: persona.id === p.id ? "#fff" : "var(--c-fg)" }}>{p.initials}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>{p.role}</div>
              </div>
              {persona.id === p.id && <Icon name="check" size={14}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ persona, onPersona, theme, onTheme, scenario, onScenario, breadcrumb }) {
  return (
    <header className="topbar">
      <div className="topbar-crumbs">
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep"><Icon name="chevRight" size={12}/></span>}
            <span className={i === breadcrumb.length - 1 ? "now" : ""}>{b}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-search">
        <Icon name="search" size={14}/>
        <input placeholder="Search material, batch, bin, plant…"/>
        <kbd>⌘K</kbd>
      </div>
      <div className="topbar-spacer"/>
      <div className="topbar-actions">
        <button className="icon-btn" title="Refresh" onClick={() => location.reload()}><Icon name="refresh"/></button>
        <button className="icon-btn" title="Notifications"><Icon name="bell"/><span className="dot"/></button>
        <button className="icon-btn" title={theme === "light" ? "Switch to dark" : "Switch to light"}
                onClick={() => onTheme(theme === "light" ? "dark" : "light")}>
          <Icon name={theme === "light" ? "moon" : "sun"}/>
        </button>
        <div style={{ width: 1, height: 22, background: "var(--c-stroke)", margin: "0 4px" }}/>
        <PersonaPill persona={persona} onChange={onPersona}/>
      </div>
    </header>
  );
}

function ContextBar({ title, sub, freshness, scenario, filters, setFilters, savedView, onSave }) {
  return (
    <div className="context">
      <div className="context-row1">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="context-title">{title}</h1>
          {sub && <div className="context-sub">{sub}</div>}
        </div>
        <div className="context-meta">
          {scenario === "outage" ? (
            <span className="freshness fail"><span className="pulse"/>Data feed degraded · partial</span>
          ) : scenario === "warning" ? (
            <span className="freshness stale"><span className="pulse"/>Snapshot 47 min old</span>
          ) : (
            <span className="freshness"><span className="pulse"/>Live · as of 12:42 GMT</span>
          )}
          <button className="btn btn-ghost btn-sm"><Icon name="download"/>Export</button>
          <button className="btn btn-ghost btn-sm"><Icon name="share"/>Share</button>
        </div>
      </div>

      <div className="filterbar">
        <FilterChipGroup
          label="Plant"
          value={filters.plant === "all" ? "All plants (5)" : filters.plant}
          options={["all", "1000", "2000", "3000", "4000", "5000"]}
          active={filters.plant !== "all"}
          onSelect={v => setFilters({ ...filters, plant: v })}
        />
        <FilterChipGroup
          label="Storage Loc"
          value={filters.sloc === "all" ? "All locs" : filters.sloc}
          options={["all", "0001", "0002", "0003", "QM01", "BL01", "INTR"]}
          active={filters.sloc !== "all"}
          onSelect={v => setFilters({ ...filters, sloc: v })}
        />
        <FilterChipGroup
          label="Material Type"
          value={filters.mtype === "all" ? "All types" : filters.mtype}
          options={["all", "FERT", "HALB", "ROH", "VERP"]}
          active={filters.mtype !== "all"}
          onSelect={v => setFilters({ ...filters, mtype: v })}
        />
        <FilterChipGroup
          label="Stock Type"
          value={filters.stype === "all" ? "All stock" : filters.stype}
          options={["all", "unrestricted", "qi", "blocked", "restricted", "interim"]}
          active={filters.stype !== "all"}
          onSelect={v => setFilters({ ...filters, stype: v })}
        />
        <FilterChipGroup
          label="ABC"
          value={filters.abc === "all" ? "ABC: All" : "ABC: " + filters.abc}
          options={["all", "A", "B", "C"]}
          active={filters.abc !== "all"}
          onSelect={v => setFilters({ ...filters, abc: v })}
        />
        {(filters.plant !== "all" || filters.sloc !== "all" || filters.mtype !== "all" || filters.stype !== "all" || filters.abc !== "all") && (
          <button className="filter-clear" onClick={() => setFilters({ plant: "all", sloc: "all", mtype: "all", stype: "all", abc: "all" })}>
            <Icon name="filterX" size={12} style={{ marginRight: 4 }}/>Clear all
          </button>
        )}
        <div className="filter-saved">
          <span style={{ color: "var(--c-fg-mute)" }}>View:</span>
          <span className="filter-saved-name"><Icon name="bookmark" size={12}/>{savedView || "Default"}</span>
          <span style={{ color: "var(--c-fg-mute)" }}>·</span>
          <button className="btn btn-quiet btn-sm" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function FilterChipGroup({ label, value, active, options, onSelect }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className={`filter-chip ${active ? "active" : ""}`} onClick={() => setOpen(o => !o)}>
        <span className="chip-key">{label}</span>
        <span>{value}</span>
        <Icon name="chevDown" size={12}/>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)}/>
          <div style={{
            position: "absolute", top: 36, left: 0, zIndex: 25,
            background: "var(--c-surface)", border: "1px solid var(--c-stroke)",
            borderRadius: 6, padding: 4, minWidth: 180, boxShadow: "var(--shadow-md)",
          }}>
            {options.map(o => (
              <button key={o} className="nav-item" style={{ color: "var(--c-fg)", padding: "6px 10px", fontSize: 12 }}
                      onClick={() => { onSelect(o); setOpen(false); }}>
                <span style={{ flex: 1, textAlign: "left" }}>{o === "all" ? "All" : o}</span>
                {value.includes(o) && o !== "all" && <Icon name="check" size={12}/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

window.Shell = { Nav, TopBar, ContextBar, MODULES, PERSONAS };
