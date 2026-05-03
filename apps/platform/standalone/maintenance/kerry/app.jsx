// ============================================================================
// App orchestrator
// ============================================================================
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "persona": "planner",
  "drawerOpen": true,
  "navCollapsed": false,
  "demoState": "normal"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState("overview");
  const [selected, setSelected] = useState(null); // {type, id}

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  const onOpen = (item) => {
    setSelected(item);
    setTweak("drawerOpen", true);
  };
  const onCloseDrawer = () => setTweak("drawerOpen", false);

  const moduleNames = {
    overview: ["Cockpit", "Control Tower"],
    notif: ["Work", "Notifications"],
    orders: ["Work", "Maintenance Orders"],
    backlog: ["Work", "Backlog & Planning"],
    reliability: ["Analytics", "Reliability"],
    assets: ["Analytics", "Asset Health", "Spray Dryer #2"],
    exceptions: ["Governance", "Exceptions"],
  };

  const renderModule = () => {
    const props = { onOpen, onNav: setRoute, persona: tweaks.persona };
    if (tweaks.demoState === "stale" && route === "overview") {
      return (
        <div className="vstack" style={{gap: 16}}>
          <div className="stale-banner"><Icon name="cloudOff" size={14}/>Snapshot from 47 minutes ago — Databricks job lagging. Showing last good values.</div>
          <ControlTower {...props}/>
        </div>
      );
    }
    if (tweaks.demoState === "loading") {
      return <SkeletonView/>;
    }
    if (tweaks.demoState === "empty") {
      return <Empty title="No data for selected filters" sub="Try widening the date range or clearing planner group filter." icon="search"
        action={<button className="btn btn-sm" style={{marginTop: 12}}>Reset filters</button>}/>;
    }
    if (tweaks.demoState === "error") {
      return <AlertStrip tone="critical">
        <strong>Data source error · DBX-503</strong> — Databricks Gold semantic model is unreachable. Retry in 30s, or contact ConnectIO support.
      </AlertStrip>;
    }
    switch(route) {
      case "overview": return <ControlTower {...props}/>;
      case "backlog": return <BacklogWorkbench {...props}/>;
      case "reliability": return <Reliability {...props}/>;
      case "assets": return <AssetHealth {...props}/>;
      case "notif": return <Notifications {...props}/>;
      case "orders": return <Orders {...props}/>;
      case "exceptions": return <Exceptions {...props}/>;
      default: return null;
    }
  };

  const showDrawer = tweaks.drawerOpen && selected;

  return (
    <div className="app" data-nav={tweaks.navCollapsed ? "collapsed" : "expanded"}>
      <LeftNav active={route} onNav={(r) => { setRoute(r); setSelected(null); }} collapsed={tweaks.navCollapsed}/>

      <div className="main">
        <TopBar
          crumbs={moduleNames[route] || ["Cockpit"]}
          onToggleNav={() => setTweak("navCollapsed", !tweaks.navCollapsed)}
          persona={tweaks.persona}
        />
        {route !== "assets" && <FilterBar filters={{}} onChange={() => {}}/>}

        <div className="content-with-drawer" data-drawer-open={showDrawer ? "true" : "false"}>
          <div className="content thin-scroll">{renderModule()}</div>
          {showDrawer && (
            <div className="detail-drawer thin-scroll">
              <DetailDrawer item={selected} onClose={() => setSelected(null)}/>
            </div>
          )}
        </div>
      </div>

      <Tweaks tweaks={tweaks} setTweak={setTweak}/>
    </div>
  );
}

const SkeletonView = () => (
  <div className="vstack" style={{gap: 16}}>
    <div className="skel" style={{height: 24, width: 280}}/>
    <div className="skel" style={{height: 14, width: 420}}/>
    <div className="grid cols-4">
      {[0,1,2,3].map(i => <div key={i} className="skel" style={{height: 110}}/>)}
    </div>
    <div className="grid cols-12">
      <div className="skel span-7" style={{height: 280}}/>
      <div className="skel span-5" style={{height: 280}}/>
    </div>
  </div>
);

const Tweaks = ({ tweaks, setTweak }) => (
  <TweaksPanel title="Tweaks" defaultPosition="bottom-right" defaultOpen={false}>
    <TweakSection title="Appearance">
      <TweakRadio label="Theme" value={tweaks.theme} onChange={(v) => setTweak("theme", v)}
        options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"}]}/>
      <TweakRadio label="Density" value={tweaks.density} onChange={(v) => setTweak("density", v)}
        options={[{value:"comfortable",label:"Comfortable"},{value:"compact",label:"Compact"}]}/>
      <TweakToggle label="Collapse left nav" value={tweaks.navCollapsed} onChange={(v) => setTweak("navCollapsed", v)}/>
    </TweakSection>
    <TweakSection title="Persona view">
      <TweakSelect label="Default persona" value={tweaks.persona} onChange={(v) => setTweak("persona", v)}
        options={[
          {value:"planner",label:"Maintenance Planner"},
          {value:"manager",label:"Maintenance Manager"},
          {value:"reliability",label:"Reliability Engineer"},
          {value:"supervisor",label:"Supervisor"},
        ]}/>
    </TweakSection>
    <TweakSection title="Detail drawer">
      <TweakToggle label="Open by default" value={tweaks.drawerOpen} onChange={(v) => setTweak("drawerOpen", v)}/>
    </TweakSection>
    <TweakSection title="Demo states">
      <TweakSelect label="Data state" value={tweaks.demoState} onChange={(v) => setTweak("demoState", v)}
        options={[
          {value:"normal",label:"Normal"},
          {value:"stale",label:"Stale snapshot"},
          {value:"loading",label:"First load (skeleton)"},
          {value:"empty",label:"No data for filters"},
          {value:"error",label:"Data source error"},
        ]}/>
    </TweakSection>
  </TweaksPanel>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
