// app.jsx — Main app, routing, state

const { Nav, TopBar, ContextBar, MODULES, PERSONAS } = window.Shell;
const useTweaks = window.useTweaks || ((d) => [d, () => {}]);

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "compact",
  "scenario": "live",
  "showAnnotations": false,
  "accentEmphasis": "default"
}/*EDITMODE-END*/;

const TITLES = {
  overview:   { title: "Control Tower", sub: "Cross-plant inventory health, IM ↔ WM reconciliation, exceptions" },
  im:         { title: "IM Inventory Explorer", sub: "On-hand stock by material, plant, and storage location" },
  wm:         { title: "WM Warehouse Explorer", sub: "Storage types, bins, quants, transfer orders, interim watch" },
  recon:      { title: "Reconciliation Workbench", sub: "Triage and resolve every IM/WM mismatch — assign ownership, post adjustments" },
  exceptions: { title: "Exceptions", sub: "Active queue · severity-ranked · with SLA tracking and bulk actions" },
  analytics:  { title: "Inventory Analytics & Insights", sub: "Aging, ABC/XYZ, expiry risk, slow movers" },
  spec:       { title: "Design Spec & Documentation", sub: "Module map, data sources, design rationale" },
};

const CRUMBS = {
  overview:   ["Inventory", "Control Tower"],
  im:         ["Inventory", "IM Inventory"],
  wm:         ["Inventory", "WM Warehouse"],
  recon:      ["Workflows", "Reconciliation Workbench"],
  exceptions: ["Workflows", "Exceptions"],
  analytics:  ["Inventory", "Analytics & Insights"],
  spec:       ["Reference", "Design Spec"],
};

function App() {
  const [tw, setTw] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("overview");
  const [persona, setPersona] = React.useState(PERSONAS[0]);
  const [collapsed, setCollapsed] = React.useState(false);
  const [filters, setFilters] = React.useState({ plant: "all", sloc: "all", mtype: "all", stype: "all", abc: "all" });
  const [savedView, setSavedView] = React.useState(null);
  const [drawerItem, setDrawerItem] = React.useState(null);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tw.theme);
    document.documentElement.setAttribute("data-density", tw.density);
    document.documentElement.setAttribute("data-annotations", tw.showAnnotations ? "on" : "off");
  }, [tw.theme, tw.density, tw.showAnnotations]);

  // Filter rows by current filters
  const D = window.__INV_DATA__;
  const rows = React.useMemo(() => {
    return D.STOCK_ROWS.filter(r => {
      if (filters.plant !== "all" && r.plant !== filters.plant) return false;
      if (filters.sloc !== "all" && r.storageLoc !== filters.sloc) return false;
      if (filters.mtype !== "all" && r.mtype !== filters.mtype) return false;
      if (filters.abc !== "all" && r.abc !== filters.abc) return false;
      if (filters.stype !== "all") {
        const map = { unrestricted: "unrestricted", qi: "qi", blocked: "blocked", restricted: "restricted", interim: "interim" };
        const k = map[filters.stype];
        if (k && r[k] === 0) return false;
      }
      return true;
    });
  }, [filters]);

  const plantSummary = React.useMemo(() => D.plantSummary(rows), [rows]);

  const t = TITLES[route];
  const screen = (() => {
    switch (route) {
      case "overview":   return <window.Overview rows={rows} plants={plantSummary} persona={persona} onNav={setRoute} onOpenItem={setDrawerItem}/>;
      case "im":         return <window.IMExplorer rows={rows} persona={persona} onOpenItem={setDrawerItem}/>;
      case "wm":         return <window.WMExplorer rows={rows} onOpenItem={setDrawerItem}/>;
      case "recon":      return <window.Recon onOpenItem={setDrawerItem}/>;
      case "exceptions": return <window.Exceptions onOpenItem={setDrawerItem}/>;
      case "analytics":  return <window.Analytics/>;
      case "spec":       return <window.Spec onNav={setRoute}/>;
      default:           return <div>404</div>;
    }
  })();

  return (
    <div className={`app ${collapsed ? "nav-collapsed" : ""}`} data-scenario={tw.scenario}>
      <Nav current={route} onNav={setRoute} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(c => !c)}/>
      <div className="main">
        <TopBar persona={persona} onPersona={setPersona}
                theme={tw.theme} onTheme={(v) => setTw("theme", v)}
                scenario={tw.scenario} onScenario={(v) => setTw("scenario", v)}
                breadcrumb={CRUMBS[route]}/>
        <ContextBar
          title={t.title} sub={t.sub}
          scenario={tw.scenario}
          filters={filters} setFilters={setFilters}
          savedView={savedView} onSave={() => setSavedView("Plant 3000 watch")}/>
        <main className="content">
          {screen}
        </main>
      </div>
      {drawerItem && <Drawer item={drawerItem} onClose={() => setDrawerItem(null)}/>}
      {window.InvTweaksPanel && <window.InvTweaksPanel tw={tw} setTw={setTw}/>}
    </div>
  );
}

function Drawer({ item, onClose }) {
  const { Icon, K, Money } = window.UI;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,15,20,0.4)", zIndex: 40 }}/>
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--c-surface)", borderLeft: "1px solid var(--c-stroke)", zIndex: 41, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--c-stroke)", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="eyebrow" style={{ flex: 1 }}>Detail</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x"/></button>
        </div>
        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "var(--font-mono)", marginBottom: 4 }}>{item.material || item.id || item.bin}</div>
          <div style={{ fontSize: 12, color: "var(--c-fg-mute)", marginBottom: 12 }}>{item.desc || item.details || item.type || ""}</div>
          <pre style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--c-surface-sunk)", padding: 12, borderRadius: 4, overflow: "auto", color: "var(--c-fg)" }}>
{JSON.stringify(item, null, 2)}
          </pre>
        </div>
      </aside>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
