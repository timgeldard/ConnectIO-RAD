/* Shell — brand, top bar, left nav, context bar, status bar */

const NAV = [
  { group: 'WORK' },
  { id: 'overview',     label: 'Overview',          icon: 'home' },
  { id: 'tr-creation',  label: 'TR Creation',       icon: 'plus', badge: 12 },
  { id: 'dispatch',     label: 'Dispatch',          icon: 'radio', badge: 6 },
  { id: 'consolidated', label: 'Consolidated Pick', icon: 'merge' },
  { group: 'CONFIG' },
  { id: 'layouts',      label: 'Layouts & Views',   icon: 'column' },
  { id: 'audit',        label: 'Audit & Logs',      icon: 'history' },
];

function BrandCell({ narrow }) {
  return (
    <div className="brand">
      <div className="k-mark">K</div>
      <div className="brand-text">
        <span className="eyebrow">Kerry · WMS</span>
        <span className="name">Cockpit</span>
      </div>
    </div>
  );
}

function TopBar({ screen, onToggleNav, drawerOpen }) {
  const titles = {
    overview: 'Overview',
    'tr-creation': 'TR Creation',
    dispatch: 'Dispatch',
    consolidated: 'Consolidated Picking',
    layouts: 'Layouts & Views',
    audit: 'Audit & Logs',
  };
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  return (
    <div className="topbar">
      <button className="iconbtn" onClick={onToggleNav} title="Toggle navigation">
        <Icon name="grid"/>
      </button>
      <div className="crumbs">
        <span>Plant 1101 · Listowel</span>
        <span className="sep">›</span>
        <span>WH 200</span>
        <span className="sep">›</span>
        <span className="current">{titles[screen]}</span>
      </div>
      <div className="grow"/>
      <span className="clock">{time} · Shift A · Day 122</span>
      <button className="iconbtn" title="Refresh"><Icon name="refresh"/></button>
      <button className="iconbtn" title="Notifications" style={{position:'relative'}}>
        <Icon name="bell"/>
        <span style={{position:'absolute', top:4, right:4, width:6, height:6, borderRadius:999, background:'var(--sunset)'}}/>
      </button>
      <span className="userchip">
        <span className="avatar">MD</span>
        <span>M. Dunne</span>
        <Icon name="chevronDown" size={12}/>
      </span>
    </div>
  );
}

function LeftNav({ screen, setScreen, narrow }) {
  return (
    <aside className="nav">
      {NAV.map((n, i) => {
        if (n.group) return <div key={'g'+i} className="group-label">{n.group}</div>;
        const active = screen === n.id;
        return (
          <button key={n.id} className={'nav-item' + (active ? ' active' : '')} onClick={() => setScreen(n.id)}>
            <Icon name={n.icon}/>
            <span className="label">{n.label}</span>
            {n.badge ? <span className="badge">{n.badge}</span> : null}
          </button>
        );
      })}
      <div className="nav-foot">
        <div className="rf-pulse">
          <span className="dot"/>
          <span className="label">14 RF guns active · 0 idle</span>
        </div>
      </div>
    </aside>
  );
}

function ContextBar({ tweaks, setTweak }) {
  return (
    <div className="ctxbar">
      <button className="pill lock" title="Plant context (locked to your role)">
        <Icon name="factory" size={13}/>
        <span className="key">Plant</span>
        <span className="val">1101 Listowel</span>
        <Icon name="lock" size={11}/>
      </button>
      <button className="pill">
        <Icon name="boxes" size={13}/>
        <span className="key">WH</span>
        <span className="val">200 · Listowel Bulk</span>
        <Icon name="chevronDown" size={11} className="caret"/>
      </button>
      <span className="divider"/>
      <button className="pill">
        <Icon name="clock" size={13}/>
        <span className="key">Window</span>
        <span className="val">02 May · Today + 1</span>
        <Icon name="chevronDown" size={11} className="caret"/>
      </button>
      <button className="pill">
        <Icon name="filter" size={13}/>
        <span className="key">Status</span>
        <span className="val">Open + WIP</span>
        <Icon name="chevronDown" size={11} className="caret"/>
      </button>
      <button className="pill">
        <Icon name="layers" size={13}/>
        <span className="key">Source</span>
        <span className="val">All</span>
        <Icon name="chevronDown" size={11} className="caret"/>
      </button>
      <span className="grow"/>
      <span className="saved-view">
        <Icon name="star" size={12}/>
        My Warehouse
        <Icon name="chevronDown" size={11}/>
      </span>
      <button className="quick-search">
        <Icon name="search" size={13}/>
        <span>Search PO, TR, material…</span>
        <kbd>⌘ K</kbd>
      </button>
    </div>
  );
}

function StatusBar({ logCount }) {
  return (
    <div className="statusbar">
      <span className="item"><span className="dot"/> SAP ECC · linked</span>
      <span className="item"><span className="dot"/> RF gateway · 14 / 14</span>
      <span className="item"><span className="dot warn"/> 1 stock warning</span>
      <span className="grow"/>
      <span className="item">Auto-assign: ON · Aged threshold 30m · {logCount} log entries</span>
      <span className="item">v 4.2.0 · ZWMAE0019_NEW</span>
    </div>
  );
}

window.BrandCell = BrandCell;
window.TopBar = TopBar;
window.LeftNav = LeftNav;
window.ContextBar = ContextBar;
window.StatusBar = StatusBar;
