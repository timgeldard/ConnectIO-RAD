/* Main app entry */

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "regular",
  "theme": "light",
  "navWidth": "regular",
  "showAuto": true,
  "accentLime": true
}/*EDITMODE-END*/;

function App() {
  const [screen, setScreen] = useState('tr-creation');
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [navOpen, setNavOpen] = useState(true);

  const narrow = !navOpen || tweaks.navWidth === 'narrow';
  const densityClass = 'density-' + tweaks.density;
  const themeClass = tweaks.theme === 'night' ? 'theme-night' : '';

  let Screen = Overview;
  if (screen === 'tr-creation') Screen = TRCreation;
  else if (screen === 'dispatch') Screen = Dispatch;
  else if (screen === 'consolidated') Screen = Consolidated;
  else if (screen === 'layouts') Screen = LayoutsScreen;
  else if (screen === 'audit') Screen = Audit;

  return (
    <div className={`app ${narrow?'is-narrow':''} ${densityClass} ${themeClass}`} data-screen-label={screen}>
      <BrandCell narrow={narrow}/>
      <TopBar screen={screen} onToggleNav={() => setNavOpen(!navOpen)}/>
      <LeftNav screen={screen} setScreen={setScreen} narrow={narrow}/>
      <ContextBar tweaks={tweaks} setTweak={setTweak}/>
      <main className="main">
        <Screen/>
      </main>
      <StatusBar logCount={9}/>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Density">
          <TweakRadio value={tweaks.density} onChange={v => setTweak('density', v)}
            options={[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'comfortable',label:'Comfortable'}]}/>
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio value={tweaks.theme} onChange={v => setTweak('theme', v)}
            options={[{value:'light',label:'Day'},{value:'night',label:'Night dispatch'}]}/>
        </TweakSection>
        <TweakSection title="Navigation">
          <TweakRadio value={tweaks.navWidth} onChange={v => setTweak('navWidth', v)}
            options={[{value:'regular',label:'Wide'},{value:'narrow',label:'Icon-only'}]}/>
        </TweakSection>
        <TweakSection title="Jump to screen">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
            {['overview','tr-creation','dispatch','consolidated','layouts','audit'].map(s => (
              <button key={s} className={'btn btn-sm ' + (screen===s?'btn-primary':'btn-secondary')} onClick={() => setScreen(s)}>{s}</button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
