/* App shell — left rail, top bar, filter bar, drawer host */
const { useState: useStateShell } = React;

const NAV = [
  { group: 'COCKPIT', items: [
    { id: 'overview',  label: 'Control Tower',          icon: 'gauge' },
  ]},
  { group: 'LIFECYCLE', items: [
    { id: 'sto',       label: 'STO & In-Transit',       icon: 'truck' },
    { id: 'tpmInv',    label: 'TPM Inventory & WIP',    icon: 'box' },
    { id: 'process',   label: 'Toll Process',           icon: 'flask' },
    { id: 'returns',   label: 'Return & Receipt',       icon: 'inbox' },
    { id: 'fulfil',    label: 'Customer / Interplant',  icon: 'package' },
  ]},
  { group: 'INVESTIGATE', items: [
    { id: 'trace',     label: 'Traceability',           icon: 'route' },
    { id: 'except',    label: 'Exceptions',             icon: 'alert', badge: '47', badgeKind: 'is-risk' },
  ]},
  { group: 'ADMIN', items: [
    { id: 'views',     label: 'Saved Views',            icon: 'bookmark' },
    { id: 'settings',  label: 'Settings',               icon: 'settings' },
  ]},
];

const Rail = ({ collapsed, view, setView }) => (
  <aside className="rail">
    {NAV.map((grp, gi) => (
      <div className="rail__group" key={gi}>
        <div className="rail__label">{grp.group}</div>
        {grp.items.map(it => (
          <div key={it.id}
               className={'rail__item ' + (view === it.id ? 'is-active' : '')}
               onClick={() => setView(it.id)}>
            <Icon name={it.icon} size={16} />
            <span>{it.label}</span>
            {it.badge && <span className={'badge ' + (it.badgeKind || '')}>{it.badge}</span>}
          </div>
        ))}
      </div>
    ))}
    <div className="rail__foot">
      <span className="freshness-dot" />
      <div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>Databricks Gold</div>
        <div className="mono">refreshed 09:42 UTC</div>
      </div>
    </div>
  </aside>
);

const TopBar = ({ railCollapsed, toggleRail, view, dark, toggleDark }) => {
  const labels = {
    overview: 'Control Tower', sto: 'STO & In-Transit Inventory',
    tpmInv: 'TPM Plant Inventory & WIP', process: 'Toll Process Tracker',
    returns: 'Return & Receipt Tracker', fulfil: 'Customer / Interplant Fulfilment',
    trace: 'Traceability & Reconciliation', except: 'TPM Exceptions',
    views: 'Saved Views', settings: 'Settings',
  };
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button className="iconbtn" onClick={toggleRail} style={{ color: '#fff' }}>
          <Icon name="menu" size={16} />
        </button>
        {!railCollapsed && (
          <>
            <img src="assets/kerry-logo-white.png" alt="Kerry" />
            <span className="topbar__product">TPM</span>
          </>
        )}
      </div>
      <nav className="topbar__breadcrumbs">
        <span className="crumb">ConnectIO-RAD</span>
        <span className="sep">/</span>
        <span className="crumb">Supply Chain</span>
        <span className="sep">/</span>
        <span className="crumb is-current">{labels[view] || 'TPM'}</span>
      </nav>
      <div className="topbar__actions">
        <div className="topbar__search">
          <Icon name="search" size={14} />
          <input placeholder="Search material, batch, STO, GR, customer…" />
          <kbd>⌘K</kbd>
        </div>
        <button className="iconbtn" title="Toggle theme" onClick={toggleDark}>
          <Icon name={dark ? 'sun' : 'moon'} size={16} />
        </button>
        <button className="iconbtn" title="Notifications">
          <Icon name="bell" size={16} />
          <span className="dot" />
        </button>
        <button className="iconbtn" title="Help">
          <Icon name="help" size={16} />
        </button>
        <span className="avatar" title="Maeve Lynch · Toll Manufacturing Coordinator">ML</span>
      </div>
    </header>
  );
};

const FilterBar = ({ name, eyebrow, chips, right }) => (
  <div className="filterbar">
    <PageTitle eyebrow={eyebrow} name={name} />
    <span className="divider-v" />
    {chips}
    <button className="chip chip-add">
      <Icon name="plus" size={11} /> Add filter
    </button>
    <span className="filterbar__spacer" />
    <div className="filterbar__right">{right}</div>
  </div>
);

// Standard filter chips reused across modules
const StandardChips = ({ extra }) => (
  <>
    <Chip label="Region" value="EMEA + NA" />
    <Chip label="Source plant" value="3 of 6" />
    <Chip label="TPM plant" value="All" />
    <Chip label="Material family" value="All" />
    <Chip label="Time" value="Last 30 days" />
    {extra}
  </>
);

const StandardRight = ({ stale }) => (
  <>
    <span className={'freshness ' + (stale ? 'is-stale' : '')}>
      <span className="dot" />
      As of 09:42 UTC · {stale ? 'stale 6m' : 'live'}
    </span>
    <button className="btn btn-ghost btn-sm" title="Saved views">
      <Icon name="bookmark" size={13} /> Views
    </button>
    <button className="btn btn-sm" title="Export">
      <Icon name="download" size={13} /> Export
    </button>
    <button className="btn btn-sm" title="Share">
      <Icon name="share" size={13} /> Share
    </button>
  </>
);

window.AppShell = { Rail, TopBar, FilterBar, StandardChips, StandardRight, NAV };
