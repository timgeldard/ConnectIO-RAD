// analytics.jsx — Inventory Analytics & Insights
const { Icon, Sparkline, Kpi, K, Money, Bar } = window.UI;

function Analytics() {
  const D = window.__INV_DATA__;
  const [tab, setTab] = React.useState("aging");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="Inventory Days On Hand" accent="brand" value="42.7" unit="d" delta="-1.2d" deltaDir="down" trend={D.makeTrend(51, 44, 0.02)}/>
        <Kpi label="Slow movers (>180d)" accent="warning" value="86" foot={<span>€312K tied up</span>}/>
        <Kpi label="Expiry risk (<30d)" accent="danger" value="14" foot={<span>4 expired</span>}/>
        <Kpi label="ABC-A coverage" accent="success" value="98.2%" foot={<span>SLA target 95%</span>}/>
        <Kpi label="Inventory turnover" value="8.6×" delta="+0.3" deltaDir="up" trend={D.makeTrend(53, 8, 0.04, 0.002)}/>
      </div>

      <div className="tabs">
        {[
          { k: "aging",   l: "Aging & Obsolescence" },
          { k: "abcxyz",  l: "ABC / XYZ Segmentation" },
          { k: "trend",   l: "Trend Analysis" },
          { k: "expiry",  l: "Expiry & Slow Movers" },
        ].map(t => (
          <div key={t.k} className={`tab ${tab===t.k?"active":""}`} onClick={() => setTab(t.k)}>{t.l}</div>
        ))}
      </div>

      {tab === "aging" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--gap)" }}>
          <div className="card">
            <div className="card-h"><span className="eyebrow">Composition</span><span className="title">Inventory value by age bucket (€M)</span></div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 240 }}>
                {D.AGING_BUCKETS.map(b => {
                  const max = Math.max(...D.AGING_BUCKETS.map(x=>x.value));
                  const h = (b.value/max)*200;
                  return (
                    <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>€{b.value}M</div>
                      <div style={{ height: h, width: "100%", background: b.color, borderRadius: "3px 3px 0 0", opacity: .9 }}/>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-mute)" }}>{b.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px solid var(--c-stroke)", marginTop: 20, paddingTop: 14, fontSize: 12, color: "var(--c-fg-mute)" }}>
                <strong style={{ color: "var(--c-fg)" }}>€2.7M</strong> at risk in 181d+ buckets. <strong style={{ color: "var(--c-danger)" }}>€0.9M</strong> &gt;365d may require write-down review.
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><span className="eyebrow">Top exposures</span><span className="title">Aged stock by material</span></div>
            <table className="tbl">
              <thead><tr><th>Material</th><th>Age</th><th className="num">Value</th></tr></thead>
              <tbody>
                {[
                  ["400-7732 · Onion N-220", "240d", 18400, "danger"],
                  ["800-2204 · Vanilla Madagascar", "210d", 14200, "danger"],
                  ["500-3318 · HOWARU Probiotic", "186d", 12600, "warning"],
                  ["300-1112 · Maltodextrin DE-19", "168d", 9100, "warning"],
                  ["600-9135 · NaCl PDV", "155d", 4200, "warning"],
                ].map(([m,a,v,c],i)=>(
                  <tr key={i}><td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{m}</td>
                    <td><span className={`badge ${c}`}>{a}</span></td>
                    <td className="num">{Money(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "abcxyz" && (
        <div className="card">
          <div className="card-h"><span className="eyebrow">Segmentation</span><span className="title">ABC × XYZ matrix · 3 plants · 1,678 lines</span></div>
          <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(3, 1fr)", gap: 4 }}>
              <div></div>
              {["X — stable","Y — variable","Z — erratic"].map(h => <div key={h} style={{ padding: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)", textAlign: "center", letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</div>)}
              {["A","B","C"].map(abc => (
                <React.Fragment key={abc}>
                  <div style={{ padding: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: ".06em", textTransform: "uppercase" }}>{abc}</div>
                  {["X","Y","Z"].map(xyz => {
                    const c = D.ABC_XYZ.find(x => x.abc === abc && x.xyz === xyz);
                    const intensity = c.value / 35;
                    const bg = abc === "A" ? `color-mix(in srgb, var(--c-brand) ${20 + intensity*60}%, var(--c-surface))` :
                               abc === "B" ? `color-mix(in srgb, var(--c-info) ${20 + intensity*60}%, var(--c-surface))` :
                                            `color-mix(in srgb, var(--c-fg-mute) ${10 + intensity*30}%, var(--c-surface))`;
                    return (
                      <div key={xyz} style={{ padding: 16, background: bg, borderRadius: 6, color: abc === "A" && xyz === "X" ? "#fff" : "var(--c-fg)" }}>
                        <div style={{ fontSize: 11, opacity: .8 }}>{c.label}</div>
                        <div style={{ fontWeight: 700, fontSize: 22, marginTop: 6 }}>€{c.value}M</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: .8 }}>{c.lines} lines</div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="banner info" style={{ marginTop: 18 }}>
              <Icon name="zap" size={16}/>
              <div><strong>A/Z combinations are highest risk:</strong> high value × erratic demand. 18 lines, €3.8M — review safety stock and dual-source.</div>
            </div>
          </div>
        </div>
      )}

      {tab === "trend" && (
        <div className="card">
          <div className="card-h"><span className="eyebrow">90-day trend</span><span className="title">On-hand value vs. demand</span></div>
          <div style={{ padding: 20, height: 320 }}>
            <Sparkline data={D.makeTrend(71, 100, 0.04, 0.002)} color="var(--c-brand)" height={280}/>
          </div>
        </div>
      )}

      {tab === "expiry" && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Material</th><th>Batch</th><th>Plant</th><th className="num">Qty</th><th>Expiry</th><th>Days</th><th className="num">Value</th><th>Action</th></tr></thead>
            <tbody>
              {[
                ["800-2240","B2025332-1","5000",410,"2026-04-29",-3,1850,"danger","Expired"],
                ["100-2034","B2025301-2","1000",1240,"2026-05-12",10,7400,"warning","Quarantine"],
                ["500-3301","B2025290-1","2000",2200,"2026-05-18",16,28400,"warning","Promote"],
                ["300-1108","B2025276-1","1000",4800,"2026-05-30",28,6400,"info","Monitor"],
              ].map(([m,b,p,q,e,d,v,c,a],i)=>(
                <tr key={i}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{m}</td>
                  <td className="code muted">{b}</td>
                  <td className="code">{p}</td>
                  <td className="num">{q.toLocaleString()}</td>
                  <td className="code muted">{e}</td>
                  <td><span className={`badge ${c}`}>{d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}</span></td>
                  <td className="num">{Money(v)}</td>
                  <td><button className="btn btn-ghost btn-sm">{a}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
window.Analytics = Analytics;
