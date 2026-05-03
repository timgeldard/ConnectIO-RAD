// overview.jsx — Control Tower

const { Icon, Sparkline, Kpi, StackBar, MismatchBadge, StockTypeBadge, SeverityBar, Money, K, Bar } = window.UI;

function Overview({ rows, plants, persona, onNav, onOpenItem }) {
  const D = window.__INV_DATA__;
  const im_total = rows.reduce((s,r) => s + r.im_total, 0);
  const wm_total = rows.reduce((s,r) => s + r.wm_total, 0);
  const value_eur = rows.reduce((s,r) => s + r.value_eur, 0);
  const true_mm = rows.filter(r => r.mismatch_kind === "true").length;
  const timing_mm = rows.filter(r => r.mismatch_kind === "timing").length;
  const interim_mm = rows.filter(r => r.mismatch_kind === "interim").length;
  const interim_qty = rows.reduce((s,r) => s + r.interim, 0);
  const blocked_qty = rows.reduce((s,r) => s + r.blocked, 0);
  const qi_qty = rows.reduce((s,r) => s + r.qi, 0);

  const trend = D.makeTrend(11, 480000, 0.03, 0.001);
  const reconTrend = D.makeTrend(22, 30, 0.18, -0.003).map(v => Math.max(8, v));
  const valueTrend = D.makeTrend(33, value_eur, 0.02);
  const interimTrend = D.makeTrend(44, interim_qty, 0.05);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Alert strip */}
      <div className="alert-strip">
        <div className="alert-strip-l">
          <Icon name="alert" size={14}/> 3 critical · 9 priority
        </div>
        <div className="alert-strip-list">
          <div className="alert-strip-item" onClick={() => onNav("exceptions")}>
            <div className="as-h"><span className="badge solid-danger">SEV 4</span> Negative stock — Plant 3000</div>
            <div className="as-d">Bin RT-A-08-02 · WM quant -120 KG · 6h ago</div>
          </div>
          <div className="alert-strip-item" onClick={() => onNav("exceptions")}>
            <div className="as-h"><span className="badge solid-danger">SEV 4</span> IM/WM variance -8.5%</div>
            <div className="as-d">500-3301 LipidShield · Plant 2000 · €41,200 exposure</div>
          </div>
          <div className="alert-strip-item" onClick={() => onNav("exceptions")}>
            <div className="as-h"><span className="badge solid-warning">SEV 3</span> Open TO &gt; 24h</div>
            <div className="as-d">TO 0001294821 · NS01 · putaway from Z921</div>
          </div>
          <div className="alert-strip-item" onClick={() => onNav("recon")}>
            <div className="as-h"><span className="badge solid-warning">SEV 3</span> Aged QI 18h</div>
            <div className="as-d">300-1108 Lactose · 8,800 KG locked in QI</div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="On-Hand · IM" accent="brand"
          value={K(im_total)} unit="KG"
          delta="+2.1%" deltaDir="up" trend={trend}
          info="Sum of unrestricted, QI, blocked, restricted, interim across all plants"
          spec="KPI-1"/>
        <Kpi label="On-Hand · WM" accent="brand"
          value={K(wm_total)} unit="KG"
          delta="-0.4%" deltaDir="down" trend={D.makeTrend(12, wm_total/1000, 0.03)}
          info="WM quants summed across active warehouses"/>
        <Kpi label="Inventory Value" accent="success"
          value={Money(value_eur)} unit=""
          delta="+€38K" deltaDir="up" trend={D.makeTrend(13, value_eur/1000, 0.025)}
          info="Standard cost × on-hand quantity"/>
        <Kpi label="True Variance Lines" accent="danger"
          value={true_mm.toString()}
          delta="-3 vs yesterday" deltaDir="down" trend={reconTrend}
          info="IM/WM mismatches not explained by interim/timing"
          spec="KPI-2"/>
        <Kpi label="Interim / In-Process" accent="purple"
          value={K(interim_qty)} unit="KG"
          delta="+12.3%" deltaDir="up" trend={interimTrend}
          info="Stock in interim storage types (921/922/931) — not yet posted to final bin"/>
        <Kpi label="Open Exceptions" accent="warning"
          value="12" foot={<><span>3 SEV-4 · 4 SEV-3</span><span>SLA 92%</span></>}
          info="Active exception queue — see Exceptions module"/>
      </div>

      {/* Two-column row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)" }}>

        {/* Plant distribution */}
        <div className="card" style={{ position: "relative" }}>
          <div className="card-h">
            <span className="eyebrow">Distribution</span>
            <span className="title">Plant & warehouse health</span>
            <div className="right">
              <div className="btn-group">
                <button className="btn active">Map</button>
                <button className="btn">Table</button>
              </div>
            </div>
          </div>
          <div style={{ padding: "var(--card-pad)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {plants.map(p => {
                const reconScore = Math.max(0, 100 - p.true_mm * 4 - p.mismatches);
                const status = reconScore > 92 ? "success" : reconScore > 80 ? "warning" : "danger";
                return (
                  <div key={p.code} style={{ border: "1px solid var(--c-stroke)", borderRadius: 6, padding: 14, background: "var(--c-bg)", cursor: "pointer" }}
                       onClick={() => onNav("im")}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--c-${status})` }}/>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-mute)" }}>{p.code}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                      <span className="badge muted" style={{ marginLeft: "auto" }}>{p.warehouses.join(" · ")}</span>
                    </div>
                    <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>On-hand</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{K(p.im_total)}<span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)", marginLeft: 4 }}>KG</span></div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>Value</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{Money(p.value_eur)}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>Mismatches</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: p.true_mm > 0 ? "var(--c-danger)" : "var(--c-fg-strong)" }}>{p.mismatches}<span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)", marginLeft: 4 }}>/ {p.lines} lines</span></div>
                      </div>
                    </div>
                    <Bar pct={reconScore} color={status} height={4}/>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>
                      <span>Recon {reconScore}%</span>
                      <span>{p.true_mm} true · {p.mismatches - p.true_mm} timing/interim</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stock split */}
        <div className="card">
          <div className="card-h">
            <span className="eyebrow">Composition</span>
            <span className="title">Inventory by stock status</span>
          </div>
          <div style={{ padding: "var(--card-pad)" }}>
            {[
              { k: "unrestricted", label: "Unrestricted",  v: rows.reduce((s,r) => s + r.unrestricted, 0), color: "var(--c-success)" },
              { k: "qi",           label: "Quality Insp.", v: qi_qty,                                       color: "var(--c-info)" },
              { k: "interim",      label: "Interim",       v: interim_qty,                                  color: "var(--c-purple)" },
              { k: "restricted",   label: "Restricted",    v: rows.reduce((s,r) => s + r.restricted, 0),    color: "var(--c-warning)" },
              { k: "blocked",      label: "Blocked",       v: blocked_qty,                                  color: "var(--c-danger)" },
            ].map(item => {
              const pct = (item.v / im_total) * 100;
              return (
                <div key={item.k} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, background: item.color, borderRadius: 2, marginRight: 8 }}/>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>{item.label}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>{K(item.v)} KG</span>
                    <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-mute)", width: 42, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: "var(--c-stroke)", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: pct + "%", background: item.color, borderRadius: 999 }}/>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 14, padding: 10, background: "var(--c-purple-soft)", borderRadius: 6, fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, color: "var(--c-purple)", fontWeight: 600 }}>
                <Icon name="zap" size={12}/> Interim watch
              </div>
              <div style={{ color: "var(--c-fg)" }}>
                {K(interim_qty)} KG sitting in interim storage (Z921/Z922). 18 lines aged &gt;6h — likely IM/WM timing lag, but verify TO confirmation backlog.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation summary + Recent movements */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>

        <div className="card">
          <div className="card-h">
            <span className="eyebrow">Reconciliation</span>
            <span className="title">IM ↔ WM sync status</span>
            <div className="right">
              <button className="btn btn-ghost btn-sm" onClick={() => onNav("recon")}>Open Workbench<Icon name="arrowRight" size={12}/></button>
            </div>
          </div>
          <div style={{ padding: "var(--card-pad)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <ReconTile label="In sync"      value={rows.filter(r=>r.mismatch_kind==="match").length} color="success" hint="No action needed"/>
              <ReconTile label="Timing lag"   value={timing_mm} color="info"    hint="Self-clearing within hours"/>
              <ReconTile label="Interim"      value={interim_mm} color="purple"  hint="Stock in transit between IM/WM"/>
              <ReconTile label="True variance" value={true_mm}   color="danger"  hint="Investigation required"/>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-fg-mute)", marginBottom: 8 }}>Aging of true variances</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, paddingTop: 8 }}>
              {[
                { label: "<8h",   v: 4, color: "var(--c-warning)" },
                { label: "8-24h", v: 6, color: "var(--c-warning)" },
                { label: "1-3d",  v: 5, color: "var(--c-danger)" },
                { label: "3-7d",  v: 3, color: "var(--c-danger)" },
                { label: ">7d",   v: 2, color: "var(--c-danger)" },
              ].map(b => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ height: b.v * 8, width: "100%", background: b.color, borderRadius: "2px 2px 0 0", opacity: 0.85, position: "relative" }}>
                    <span style={{ position: "absolute", top: -16, left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>{b.v}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <span className="eyebrow">Activity</span>
            <span className="title">Recent movements</span>
            <div className="right">
              <span className="badge muted"><Icon name="history" size={10}/>Last 30 min</span>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>Time</th><th>MvT</th><th>Material</th><th className="num">Qty</th><th>Plant</th><th>Doc</th></tr>
              </thead>
              <tbody>
                {D.MOVEMENTS.map((m,i) => (
                  <tr key={i}>
                    <td className="code muted">{m.time}</td>
                    <td><span className="badge muted">{m.code}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{m.material}</div>
                      <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>{m.desc}</div>
                    </td>
                    <td className="num" style={{ color: m.qty < 0 ? "var(--c-danger)" : "var(--c-success)", fontWeight: 600 }}>
                      {m.qty > 0 ? "+" : ""}{m.qty.toLocaleString()}<span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)", marginLeft: 4 }}>{m.uom}</span>
                    </td>
                    <td className="code">{m.plant}</td>
                    <td className="code muted">{m.doc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReconTile({ label, value, color, hint }) {
  return (
    <div style={{ padding: 12, border: `1px solid var(--c-${color}-soft)`, background: `var(--c-${color}-soft)`, borderRadius: 6 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: `var(--c-${color})`, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 24, color: `var(--c-${color})`, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--c-fg-mute)", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

window.Overview = Overview;
