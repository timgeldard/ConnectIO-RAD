// wm.jsx — WM Warehouse Explorer

const { Icon, Sparkline, Kpi, Bar, K, Money } = window.UI;

function WMExplorer({ rows, onOpenItem }) {
  const D = window.__INV_DATA__;
  const [whse, setWhse] = React.useState("NS01");
  const [stSelected, setStSelected] = React.useState("0010");
  const [view, setView] = React.useState("hier"); // hier | bins

  const sts = D.STORAGE_TYPES.filter(s => s.whse === whse);
  const totalBins = sts.reduce((s,t)=>s+t.bins,0);
  const usedBins  = sts.reduce((s,t)=>s+t.used,0);
  const openTO    = sts.reduce((s,t)=>s+t.open_to,0);
  const interim   = sts.filter(s => ["0921","0922","0930"].includes(s.st)).reduce((s,t)=>s+t.used,0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="Bin Utilization" accent="brand" value={((usedBins/totalBins)*100).toFixed(0) + "%"}
             foot={<><span>{K(usedBins)} / {K(totalBins)} bins</span></>}
             trend={D.makeTrend(31, 76, 0.04)}/>
        <Kpi label="Active Quants" value={K(usedBins)} unit="bins" delta="+212" deltaDir="up"/>
        <Kpi label="Open TO" accent="warning" value={openTO.toString()} foot={<><span>{sts.filter(s=>s.open_to>10).length} ST overdue</span></>}/>
        <Kpi label="Interim Stock" accent="purple" value={K(interim)} unit="bins"
             info="Sitting in ST 0921/0922/0930 (interim putaway / pick / GI zone)"
             foot={<span>18 lines &gt; 6h</span>}/>
        <Kpi label="Cycle Count Δ (30d)" accent="success" value="0.21%" foot={<span>Below 0.5% target</span>}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "var(--gap)" }}>
        {/* hierarchy panel */}
        <div className="card">
          <div className="card-h">
            <span className="eyebrow">Hierarchy</span>
            <span className="title">Warehouses</span>
          </div>
          <div style={{ padding: 8 }}>
            {[
              { code: "NS01", name: "Naas (1000) High Bay", bins: 7620 },
              { code: "NS02", name: "Naas (1000) Cold Store", bins: 1240 },
              { code: "BL01", name: "Beloit (2000) DC",      bins: 4800 },
              { code: "RT01", name: "Rotterdam (3000) Bulk", bins: 6200 },
              { code: "RT02", name: "Rotterdam (3000) Pkg",  bins: 2100 },
              { code: "JH01", name: "Johor (4000) Mfg",      bins: 3400 },
              { code: "JB01", name: "Jaboticabal (5000)",    bins: 2900 },
            ].map(w => (
              <button key={w.code} className={`nav-item ${whse === w.code ? "active" : ""}`}
                      style={{ color: whse === w.code ? "#fff" : "var(--c-fg)", marginBottom: 2 }}
                      onClick={() => setWhse(w.code)}>
                <Icon name="warehouse" size={14}/>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{w.code}</div>
                  <div style={{ fontSize: 10, opacity: .8 }}>{w.name}</div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: .7 }}>{K(w.bins)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* storage types + bins */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <span className="eyebrow">{whse}</span>
              <span className="title">Storage types</span>
              <div className="right">
                <div className="btn-group">
                  <button className={`btn ${view === "hier" ? "active" : ""}`} onClick={() => setView("hier")}>Storage Types</button>
                  <button className={`btn ${view === "bins" ? "active" : ""}`} onClick={() => setView("bins")}>Bins</button>
                </div>
              </div>
            </div>
            {view === "hier" ? (
              <div style={{ padding: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {sts.map(s => {
                    const utilColor = s.util > 0.95 ? "danger" : s.util > 0.85 ? "warning" : "success";
                    const isInterim = ["0921","0922","0930"].includes(s.st);
                    return (
                      <button key={s.st} onClick={() => setStSelected(s.st)}
                        style={{
                          textAlign: "left",
                          padding: 14,
                          border: stSelected === s.st ? "1.5px solid var(--c-brand)" : "1px solid var(--c-stroke)",
                          background: stSelected === s.st ? "var(--c-brand-soft)" : "var(--c-surface)",
                          borderRadius: 6, cursor: "pointer",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <span className="code" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--c-brand)" }}>{s.st}</span>
                          {isInterim && <span className="badge purple" style={{ fontSize: 9 }}>Interim</span>}
                          {s.hot && <span className="badge warning" style={{ fontSize: 9 }}>Hot</span>}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{s.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>{s.used}/{s.bins} bins</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: `var(--c-${utilColor})` }}>{(s.util*100).toFixed(0)}%</span>
                        </div>
                        <Bar pct={s.util*100} color={utilColor} height={4}/>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--c-fg-mute)" }}>
                          <span>{s.open_to} open TO</span>
                          <span style={{ color: "var(--c-brand)", fontWeight: 600 }}>Drill →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ overflow: "auto", maxHeight: 480 }}>
                <table className="tbl">
                  <thead><tr><th>Bin</th><th>ST</th><th>Material</th><th>Batch</th><th className="num">Qty</th><th>Status</th><th>Open TO</th><th>Verified</th></tr></thead>
                  <tbody>
                    {D.BINS_SAMPLE.map(b => {
                      const statusMap = {
                        "U": { cls: "success", label: "Unrestr." },
                        "Q": { cls: "info", label: "QI" },
                        "B": { cls: "danger", label: "Blocked" },
                        "I": { cls: "purple", label: "Interim" },
                        "—": { cls: "muted", label: "Empty" },
                      };
                      const st = statusMap[b.status] || statusMap["—"];
                      return (
                        <tr key={b.bin} onClick={() => onOpenItem({ ...b, bin: b.bin })}>
                          <td className="code" style={{ fontWeight: 600 }}>{b.bin}</td>
                          <td><span className="badge muted">{b.st}</span></td>
                          <td className="code">{b.material}</td>
                          <td className="code muted">{b.batch}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{b.qty.toLocaleString()}<span style={{ fontSize: 10, color: "var(--c-fg-mute)", marginLeft: 3 }}>{b.uom}</span></td>
                          <td><span className={`badge ${st.cls}`}><span className="dot"/>{st.label}</span></td>
                          <td>{b.to ? <span className="code" style={{ color: "var(--c-warning)" }}>{b.to}</span> : <span className="muted">—</span>}</td>
                          <td className="muted" style={{ fontSize: 11 }}>{b.verified_h}h ago</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interim watch panel */}
          <div className="card">
            <div className="card-h">
              <span className="eyebrow">Interim watch</span>
              <span className="title">Z921 / Z922 / Z930 — stock not yet posted to final bin</span>
            </div>
            <div style={{ padding: "var(--card-pad)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { st: "0921", name: "Interim Putaway", in: 18, age: "avg 4h", note: "Inbound deliveries pending putaway TO confirmation", color: "purple" },
                { st: "0922", name: "Interim Pick",    in: 11, age: "avg 1h", note: "Pick HUs awaiting GI confirmation",                color: "info" },
                { st: "0930", name: "GI Zone",         in:  4, age: "avg 2h", note: "Outbound deliveries awaiting goods-issue",          color: "warning" },
              ].map(z => (
                <div key={z.st} style={{ padding: 12, background: `var(--c-${z.color}-soft)`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span className="code" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: `var(--c-${z.color})` }}>ST {z.st}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{z.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 22 }}>{z.in}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>open · {z.age}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>{z.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.WMExplorer = WMExplorer;
