/* Main app — composes shell, modules, drawer, and tweaks. */
const { useState } = React;
const { Rail, TopBar, FilterBar, StandardChips, StandardRight } = window.AppShell;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "showAlerts": true,
  "lifecycleStyle": "flow"
}/*EDITMODE-END*/;

const App = () => {
  const [view, setView] = useState('overview');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, ()=>{}];
  const dark = tweaks.theme === 'dark';

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const openDrawer = (d) => setDrawerData(d);
  const closeDrawer = () => setDrawerData(null);

  const labels = {
    overview: { eyebrow: 'Cockpit', name: 'Control Tower' },
    sto:      { eyebrow: 'Lifecycle · Stage 1–2', name: 'STO & In-Transit Inventory' },
    tpmInv:   { eyebrow: 'Lifecycle · Stage 3', name: 'TPM Plant Inventory & WIP' },
    process:  { eyebrow: 'Lifecycle · Stage 4', name: 'Toll Process Tracker' },
    returns:  { eyebrow: 'Lifecycle · Stage 5–6', name: 'Return & Receipt Tracker' },
    fulfil:   { eyebrow: 'Lifecycle · Stage 7', name: 'Customer / Interplant Fulfilment' },
    trace:    { eyebrow: 'Investigate', name: 'Traceability & Reconciliation Workbench' },
    except:   { eyebrow: 'Investigate', name: 'TPM Exceptions' },
    views:    { eyebrow: 'Admin', name: 'Saved Views' },
    settings: { eyebrow: 'Admin', name: 'Settings' },
  };

  const moduleProps = { openDrawer };
  const renderModule = () => {
    switch (view) {
      case 'overview': return <ModuleOverview {...moduleProps}/>;
      case 'sto':      return <ModuleSto {...moduleProps}/>;
      case 'tpmInv':   return <ModuleTpmInv {...moduleProps}/>;
      case 'process':  return <ModuleProcess {...moduleProps}/>;
      case 'returns':  return <ModuleReturns {...moduleProps}/>;
      case 'fulfil':   return <ModuleFulfil {...moduleProps}/>;
      case 'trace':    return <ModuleTrace {...moduleProps}/>;
      case 'except':   return <ModuleExcept {...moduleProps}/>;
      case 'views':    return <ModuleViews/>;
      case 'settings': return <ModuleSettings/>;
      default: return null;
    }
  };

  // Module-specific extra chip
  const moduleChips = {
    sto: <Chip label="Stage" value="In transit" active={true}/>,
    tpmInv: <Chip label="View" value="Lots"/>,
    process: <Chip label="Status" value="Active"/>,
    returns: <Chip label="Window" value="Next 14 days"/>,
    fulfil: <Chip label="Type" value="Customer + Interplant"/>,
    trace: <Chip label="Lot" value="B-2510-D" active={true}/>,
    except: <Chip label="Severity" value="P1 + P2" active={true}/>,
  };

  const lbl = labels[view] || { eyebrow: '', name: '' };

  return (
    <div className="app" data-rail={railCollapsed ? 'collapsed' : 'expanded'} data-screen-label={lbl.name}>
      <TopBar railCollapsed={railCollapsed} toggleRail={() => setRailCollapsed(c => !c)}
              view={view}
              dark={dark}
              toggleDark={() => setTweak('theme', dark ? 'light' : 'dark')}/>
      <Rail collapsed={railCollapsed} view={view} setView={setView}/>
      <main className="main">
        <FilterBar
          eyebrow={lbl.eyebrow}
          name={lbl.name}
          chips={<><StandardChips extra={moduleChips[view]}/></>}
          right={<StandardRight stale={false}/>}
        />
        <div className="canvas">{renderModule()}</div>
      </main>
      <Drawer data={drawerData} onClose={closeDrawer}/>

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Theme">
            <window.TweakRadio label="Mode" value={tweaks.theme}
                               options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'}]}
                               onChange={v=>setTweak('theme', v)}/>
            <window.TweakRadio label="Density" value={tweaks.density}
                               options={[{value:'comfortable',label:'Comfortable'},{value:'compact',label:'Compact'}]}
                               onChange={v=>setTweak('density', v)}/>
          </window.TweakSection>
          <window.TweakSection title="Control Tower">
            <window.TweakToggle label="Show alerts strip" value={tweaks.showAlerts} onChange={v=>setTweak('showAlerts', v)}/>
            <window.TweakRadio label="Lifecycle visualization" value={tweaks.lifecycleStyle}
                               options={[{value:'flow',label:'Flow'},{value:'funnel',label:'Funnel'}]}
                               onChange={v=>setTweak('lifecycleStyle', v)}/>
          </window.TweakSection>
          <window.TweakSection title="Jump to module">
            {Object.entries(labels).map(([k,v])=>(
              <window.TweakButton key={k} onClick={()=>setView(k)}>{v.name}</window.TweakButton>
            ))}
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
