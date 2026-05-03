// tweaks-wrap.jsx — Inventory cockpit tweaks panel (uses tweaks-panel.jsx primitives)

function InvTweaksPanel({ tw, setTw }) {
  const TP = window.TweaksPanel;
  if (!TP || typeof TP !== "function") return null;
  const { TweakSection, TweakRadio, TweakToggle, TweakSelect } = window;
  return (
    <TP title="Tweaks">
      <TweakSection label="Theme"/>
      <TweakRadio label="Mode" value={tw.theme} options={["light", "dark"]} onChange={v => setTw("theme", v)}/>
      <TweakRadio label="Density" value={tw.density} options={["compact", "cozy"]} onChange={v => setTw("density", v)}/>
      <TweakSection label="Data scenario"/>
      <TweakSelect label="Scenario" value={tw.scenario}
        options={[
          { label: "Live · everything fine", value: "live" },
          { label: "Snapshot stale (47m)",   value: "warning" },
          { label: "Feed degraded · partial", value: "outage" },
        ]}
        onChange={v => setTw("scenario", v)}/>
      <TweakSection label="Design"/>
      <TweakToggle label="Show spec annotations" value={tw.showAnnotations} onChange={v => setTw("showAnnotations", v)}/>
      <TweakRadio label="Brand emphasis" value={tw.accentEmphasis} options={["default", "bold", "minimal"]} onChange={v => setTw("accentEmphasis", v)}/>
    </TP>
  );
}

window.InvTweaksPanel = InvTweaksPanel;
