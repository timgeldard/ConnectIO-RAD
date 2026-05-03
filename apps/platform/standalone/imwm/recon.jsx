// recon.jsx — Reconciliation Workbench (priority module)

const { Icon, Sparkline, Kpi, MismatchBadge, K, Money, Bar } = window.UI;

function Recon({ onOpenItem }) {
  const D = window.__INV_DATA__;
  const [view, setView] = React.useState("triage"); // triage | ledger | flow
  const [filter, setFilter] = React.useState("all"); // all | true | timing | interim
  const [selectedId, setSelectedId] = React.useState("RC-2420");
  const [bulkSel, setBulkSel] = React.useState({});

  const items = D.RECON_ITEMS.filter(i => filter === "all" ? i.kind !== "match" : i.kind === filter);
  const sel = D.RECON_ITEMS.find(i => i.id === selectedId);

  const counts = {
    true: D.RECON_ITEMS.filter(i => i.kind === "true").length,
    timing: D.RECON_ITEMS.filter(i => i.kind === "timing").length,
    interim: D.RECON_ITEMS.filter(i => i.kind === "interim").length,
    match: D.RECON_ITEMS.filter(i => i.kind === "match").length,
  };
  const totalExposure = D.RECON_ITEMS.filter(i => i.kind === "true").reduce((s,i) => s + i.value_eur, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Status summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) 1.4fr", gap: "var(--gap)" }}>
        <ReconStatTile label="True variance"   value={counts.true}    color="danger"  hint="Investigation required"   onClick={() => setFilter("true")}    active={filter==="true"}/>
        <ReconStatTile label="Timing lag"      value={counts.timing}  color="info"    hint="Auto-clearing < 6h"        onClick={() => setFilter("timing")}  active={filter==="timing"}/>
        <ReconStatTile label="Interim state"   value={counts.interim} color="purple"  hint="QI/blocked status mismatch" onClick={() => setFilter("interim")} active={filter==="interim"}/>
        <ReconStatTile label="In sync"         value={counts.match + 4218} color="success" hint="No action needed"      onClick={() => setFilter("match")}/>
        <div className="kpi accent-danger">
          <div className="kpi-eyebrow">Financial exposure · open variances</div>
          <div className="kpi-value" style={{ color: "var(--c-danger)" }}>{Money(totalExposure)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>
            <span><span style={{ color: "var(--c-danger)", fontWeight: 600 }}>{counts.true}</span> open</span>
            <span><span style={{ fontWeight: 600 }}>2</span> SEV-4</span>
            <span><span style={{ fontWeight: 600 }}>72h</span> oldest</span>
          </div>
          <div className="kpi-spark"><Sparkline data={D.makeTrend(99, 80, 0.15, -0.005)} color="var(--c-danger)"/></div>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="tabs">
        <div className={`tab ${view === "triage" ? "active" : ""}`} onClick={() => setView("triage")}>
          <Icon name="inbox" size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>
          Triage Queue <span className="count">{items.length}</span>
        </div>
        <div className={`tab ${view === "ledger" ? "active" : ""}`} onClick={() => setView("ledger")}>
          <Icon name="scale" size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>
          IM ↔ WM Ledger
        </div>
        <div className={`tab ${view === "flow" ? "active" : ""}`} onClick={() => setView("flow")}>
          <Icon name="branch" size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>
          Stock Flow
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>Group by</span>
          <select style={{ height: 26, padding: "0 8px", border: "1px solid var(--c-stroke)", borderRadius: 4, background: "var(--c-surface)", fontSize: 12, color: "var(--c-fg)" }}>
            <option>Root cause</option>
            <option>Plant</option>
            <option>Owner</option>
            <option>Material</option>
            <option>Age bucket</option>
          </select>
          <button className="btn btn-ghost btn-sm"><Icon name="filter"/>Advanced</button>
        </div>
      </div>

      {view === "triage" && <TriageView items={items} selectedId={selectedId} onSelect={setSelectedId} sel={sel} bulkSel={bulkSel} setBulkSel={setBulkSel}/>}
      {view === "ledger" && <LedgerView items={items.slice(0, 8)}/>}
      {view === "flow"   && <FlowView/>}
    </div>
  );
}

function ReconStatTile({ label, value, color, hint, onClick, active }) {
  return (
    <button onClick={onClick}
      style={{
        textAlign: "left",
        padding: 14,
        border: active ? `1.5px solid var(--c-${color})` : "1px solid var(--c-stroke)",
        background: active ? `var(--c-${color}-soft)` : "var(--c-surface)",
        borderRadius: 8, cursor: "pointer",
        position: "relative",
      }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: `var(--c-${color})`, borderRadius: "8px 0 0 8px" }}/>
      <div className="kpi-eyebrow" style={{ color: `var(--c-${color})` }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.1, color: `var(--c-${color})`, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-mute)", marginTop: 4 }}>{hint}</div>
    </button>
  );
}

function TriageView({ items, selectedId, onSelect, sel, bulkSel, setBulkSel }) {
  const D = window.__INV_DATA__;
  const groupedByRoot = {
    "TO confirmation pending":         items.filter(i => i.reason && i.reason.includes("TO")),
    "QI / status mismatch":            items.filter(i => i.kind === "interim"),
    "Suspected miscount":              items.filter(i => i.reason && i.reason.toLowerCase().includes("miscount")),
    "True variance · cause unknown":   items.filter(i => i.kind === "true" && (!i.reason || (!i.reason.includes("TO") && !i.reason.toLowerCase().includes("miscount")))),
    "Timing — putaway in progress":    items.filter(i => i.reason && i.reason.toLowerCase().includes("putaway")),
  };

  const bulkCount = Object.values(bulkSel).filter(Boolean).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: "var(--gap)" }}>
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="tbl-toolbar">
          <div className="left">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-mute)" }}>{items.length} items in triage</span>
            {bulkCount > 0 && (
              <>
                <div style={{ width: 1, height: 18, background: "var(--c-stroke)" }}/>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{bulkCount} selected</span>
                <button className="btn btn-ghost btn-sm">Assign…</button>
                <button className="btn btn-ghost btn-sm">Mark timing</button>
                <button className="btn btn-ghost btn-sm">Resolve</button>
              </>
            )}
          </div>
          <div className="right">
            <button className="btn btn-ghost btn-sm"><Icon name="download"/>Export</button>
          </div>
        </div>

        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 380px)" }}>
          {Object.entries(groupedByRoot).filter(([_,v]) => v.length).map(([rc, list]) => {
            const isTrue = rc.toLowerCase().includes("variance") || rc.toLowerCase().includes("miscount");
            return (
              <React.Fragment key={rc}>
                <tr className="row-divider" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td style={{ padding: "6px 16px", background: "var(--c-surface-2)", height: 28 }}>
                    <span style={{ fontWeight: 600 }}>{rc}</span>
                    <span style={{ marginLeft: 8, opacity: .7 }}>· {list.length} items</span>
                    {isTrue && <span className="badge danger" style={{ marginLeft: 8 }}>Action required</span>}
                  </td>
                </tr>
                <table className="tbl" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{width: 28}}/><col style={{width: 76}}/><col/>
                    <col style={{width: 70}}/><col style={{width: 70}}/><col style={{width: 74}}/>
                    <col style={{width: 80}}/><col style={{width: 80}}/><col style={{width: 110}}/>
                  </colgroup>
                  <tbody>
                    {list.map(i => {
                      const ageColor = i.age_h > 48 ? "danger" : i.age_h > 24 ? "warning" : "info";
                      return (
                        <tr key={i.id} className={selectedId === i.id ? "selected" : ""} onClick={() => onSelect(i.id)}>
                          <td style={{ paddingLeft: 12 }}>
                            <input type="checkbox" checked={!!bulkSel[i.id]} onClick={e => e.stopPropagation()} onChange={e => setBulkSel({ ...bulkSel, [i.id]: e.target.checked })}/>
                          </td>
                          <td className="code" style={{ fontWeight: 600 }}>{i.id}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 11 }}>{i.material}</div>
                            <div style={{ fontSize: 11, color: "var(--c-fg-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.desc}</div>
                          </td>
                          <td className="code">{i.plant}/{i.sloc}</td>
                          <td className="num">{K(i.im_qty)}</td>
                          <td className="num" style={{ color: i.delta < 0 ? "var(--c-danger)" : i.delta > 0 ? "var(--c-info)" : "var(--c-fg-mute)", fontWeight: 600 }}>
                            {i.delta > 0 ? "+" : ""}{i.delta === 0 ? "—" : i.delta.toLocaleString()}
                          </td>
                          <td><MismatchBadge kind={i.kind}/></td>
                          <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: `var(--c-${ageColor})`, fontWeight: 600 }}>{i.age_h}h</span></td>
                          <td style={{ fontSize: 11 }}>{i.owner === "Unassigned" ? <span style={{ color: "var(--c-warning)" }}>· Unassigned</span> : i.owner}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Investigation panel */}
      <div className="card" style={{ alignSelf: "flex-start", position: "sticky", top: 0 }}>
        {sel ? <InvestigationPanel item={sel}/> : <div className="state-empty">Select an item</div>}
      </div>
    </div>
  );
}

function InvestigationPanel({ item }) {
  return (
    <div>
      <div className="card-h">
        <span className="eyebrow">{item.id} · investigation</span>
        <div className="right"><MismatchBadge kind={item.kind}/></div>
      </div>
      <div style={{ padding: "var(--card-pad)" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{item.material}</div>
          <div style={{ fontSize: 12, color: "var(--c-fg-mute)" }}>{item.desc}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <span className="badge muted">Plant {item.plant}</span>
            <span className="badge muted">SLoc {item.sloc}</span>
            {item.kind === "true" && item.age_h > 48 && <span className="badge danger">Aged {item.age_h}h</span>}
          </div>
        </div>

        {/* Big delta visualization */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, padding: 14, background: "var(--c-surface-sunk)", borderRadius: 8, marginBottom: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>IM (book)</div>
            <div style={{ fontWeight: 700, fontSize: 24, marginTop: 2 }}>{item.im_qty.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>KG</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 80, height: 24, background: item.delta === 0 ? "var(--c-success-soft)" : item.kind === "true" ? "var(--c-danger-soft)" : item.kind === "timing" ? "var(--c-info-soft)" : "var(--c-purple-soft)", borderRadius: 4, display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: item.delta === 0 ? "var(--c-success)" : item.kind === "true" ? "var(--c-danger)" : item.kind === "timing" ? "var(--c-info)" : "var(--c-purple)" }}>
                {item.delta > 0 ? "+" : ""}{item.delta === 0 ? "0" : item.delta.toLocaleString()}
              </span>
            </div>
            <Icon name="link" size={14} style={{ color: "var(--c-fg-mute)" }}/>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-fg-mute)" }}>WM (physical)</div>
            <div style={{ fontWeight: 700, fontSize: 24, marginTop: 2 }}>{item.wm_qty.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>KG</div>
          </div>
        </div>

        {/* Hypothesis */}
        <div className="banner" style={{ marginBottom: 14 }}
             className={`banner ${item.kind === "true" ? "danger" : item.kind === "timing" ? "info" : "warning"}`}>
          <Icon name={item.kind === "true" ? "alert" : "clock"} size={16}/>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {item.kind === "true"    && "True variance — physical investigation needed"}
              {item.kind === "timing"  && "Timing lag — likely self-clearing"}
              {item.kind === "interim" && "Status mismatch — IM ahead of WM"}
            </div>
            <div style={{ fontSize: 11 }}>
              {item.reason || (item.kind === "true" ? "No timing or status explanation found. Suspected physical loss, miscount, or unposted movement." : "—")}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ marginBottom: 14 }}>
          <div className="kpi-eyebrow" style={{ marginBottom: 8 }}>Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { t: "Now",        a: "Variance flagged by reconciliation engine",        c: "danger", icon: "alert" },
              { t: `${item.age_h}h ago`, a: `Last IM movement — MvT 311 · ${(item.im_qty + 200).toLocaleString()} KG`, c: "info", icon: "history" },
              { t: `${item.age_h+2}h ago`, a: "WM cycle count completed — no variance noted", c: "success", icon: "check" },
            ].map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: `var(--c-${e.c}-soft)`, color: `var(--c-${e.c})`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name={e.icon} size={11}/>
                  </div>
                  {i < 2 && <div style={{ flex: 1, width: 1, background: "var(--c-stroke)", marginTop: 2 }}/>}
                </div>
                <div style={{ flex: 1, paddingBottom: 8 }}>
                  <div style={{ fontSize: 12 }}>{e.a}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-fg-mute)" }}>{e.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Triage actions */}
        <div className="kpi-eyebrow" style={{ marginBottom: 6 }}>Disposition</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <select style={{ height: 32, padding: "0 10px", border: "1px solid var(--c-stroke)", borderRadius: 4, background: "var(--c-surface)", fontSize: 12, color: "var(--c-fg)" }}>
            <option>Reason: select…</option>
            <option>Physical miscount</option>
            <option>Unposted GI</option>
            <option>Damaged / write-off</option>
            <option>System error</option>
            <option>Pending TO confirmation</option>
          </select>
          <select style={{ height: 32, padding: "0 10px", border: "1px solid var(--c-stroke)", borderRadius: 4, background: "var(--c-surface)", fontSize: 12, color: "var(--c-fg)" }}>
            <option>Owner: {item.owner}</option>
          </select>
          <textarea placeholder="Investigation notes…" rows="2" style={{ resize: "vertical", padding: 8, border: "1px solid var(--c-stroke)", borderRadius: 4, background: "var(--c-surface)", fontSize: 12, color: "var(--c-fg)", fontFamily: "inherit" }}/>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Resolve & post adjustment</button>
            <button className="btn btn-ghost btn-sm">Snooze 4h</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerView({ items }) {
  return (
    <div className="card">
      <div className="card-h">
        <span className="eyebrow">Ledger</span>
        <span className="title">IM book ↔ WM physical · side-by-side</span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>Material / Plant</th>
            <th colSpan="2" style={{ textAlign: "center", borderRight: "2px solid var(--c-brand-soft)" }}>IM (book)</th>
            <th colSpan="2" style={{ textAlign: "center" }}>WM (physical)</th>
            <th>Δ</th>
            <th>Kind</th>
          </tr>
          <tr>
            <th></th><th></th>
            <th className="num" style={{ background: "var(--c-brand-soft)" }}>Qty</th>
            <th style={{ background: "var(--c-brand-soft)", borderRight: "2px solid var(--c-brand-soft)" }}>Status</th>
            <th className="num">Qty</th>
            <th>Status</th>
            <th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td className="code">{i.id}</td>
              <td><div style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 11 }}>{i.material}</div><div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>{i.plant} / {i.sloc}</div></td>
              <td className="num" style={{ background: "color-mix(in srgb, var(--c-brand-soft) 50%, transparent)", fontWeight: 600 }}>{i.im_qty.toLocaleString()}</td>
              <td style={{ background: "color-mix(in srgb, var(--c-brand-soft) 50%, transparent)", borderRight: "2px solid var(--c-brand-soft)" }}>
                <span className="badge success" style={{ fontSize: 9 }}>U</span>
              </td>
              <td className="num" style={{ fontWeight: 600 }}>{i.wm_qty.toLocaleString()}</td>
              <td>{i.kind === "interim" ? <span className="badge purple" style={{ fontSize: 9 }}>QI</span> : <span className="badge success" style={{ fontSize: 9 }}>U</span>}</td>
              <td className="num" style={{ color: i.delta < 0 ? "var(--c-danger)" : i.delta > 0 ? "var(--c-info)" : "var(--c-fg-mute)", fontWeight: 700 }}>
                {i.delta > 0 ? "+" : ""}{i.delta === 0 ? "—" : i.delta.toLocaleString()}
              </td>
              <td><MismatchBadge kind={i.kind}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowView() {
  // Sankey-style stock flow: IM blocks → interim → WM blocks
  return (
    <div className="card">
      <div className="card-h">
        <span className="eyebrow">Flow</span>
        <span className="title">Stock movement IM → Interim → WM (last 24h)</span>
        <div className="right">
          <span className="badge muted">Hover any band for detail</span>
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <svg viewBox="0 0 900 380" style={{ width: "100%", height: 380, display: "block" }}>
          {/* IM column */}
          <text x="60" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--c-fg-mute)" textAnchor="middle" style={{textTransform:"uppercase",letterSpacing:".08em"}}>IM</text>
          <text x="450" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--c-fg-mute)" textAnchor="middle" style={{textTransform:"uppercase",letterSpacing:".08em"}}>Interim</text>
          <text x="840" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--c-fg-mute)" textAnchor="middle" style={{textTransform:"uppercase",letterSpacing:".08em"}}>WM</text>

          {/* Source nodes (IM stock states) */}
          <g>
            <rect x="20" y="50"  width="80" height="80"  fill="var(--c-success)" rx="3"/>
            <text x="60" y="90"  fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Unrestr.</text>
            <text x="60" y="106" fontSize="10" fontFamily="var(--font-mono)" fill="#fff" textAnchor="middle">412K</text>
            <rect x="20" y="142" width="80" height="50" fill="var(--c-info)" rx="3"/>
            <text x="60" y="170" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">QI</text>
            <text x="60" y="184" fontSize="10" fontFamily="var(--font-mono)" fill="#fff" textAnchor="middle">28K</text>
            <rect x="20" y="204" width="80" height="30" fill="var(--c-warning)" rx="3"/>
            <text x="60" y="223" fontSize="10" fill="#fff" fontWeight="600" textAnchor="middle">Restr.</text>
            <rect x="20" y="246" width="80" height="40" fill="var(--c-danger)" rx="3"/>
            <text x="60" y="270" fontSize="10" fill="#fff" fontWeight="600" textAnchor="middle">Blocked</text>
          </g>

          {/* Interim nodes */}
          <g>
            <rect x="410" y="80"  width="80" height="60" fill="var(--c-purple)" rx="3"/>
            <text x="450" y="108" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Z921</text>
            <text x="450" y="124" fontSize="9" fill="#fff" textAnchor="middle" opacity=".85">putaway</text>
            <rect x="410" y="160" width="80" height="40" fill="var(--c-purple)" opacity=".75" rx="3"/>
            <text x="450" y="185" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Z922</text>
            <rect x="410" y="220" width="80" height="30" fill="var(--c-purple)" opacity=".55" rx="3"/>
            <text x="450" y="240" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Z930</text>
          </g>

          {/* Target nodes */}
          <g>
            <rect x="800" y="40"  width="80" height="100" fill="var(--c-success)" rx="3"/>
            <text x="840" y="86"  fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Bins (U)</text>
            <text x="840" y="104" fontSize="10" fontFamily="var(--font-mono)" fill="#fff" textAnchor="middle">395K</text>
            <rect x="800" y="152" width="80" height="46" fill="var(--c-info)" rx="3"/>
            <text x="840" y="178" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">QI bins</text>
            <rect x="800" y="210" width="80" height="34" fill="var(--c-danger)" rx="3"/>
            <text x="840" y="232" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">Block bins</text>
          </g>

          {/* Flows */}
          <path d="M 100,90 C 250,90 260,110 410,110" stroke="var(--c-success)" strokeWidth="38" fill="none" opacity=".25"/>
          <path d="M 490,110 C 640,110 650,90 800,90" stroke="var(--c-success)" strokeWidth="32" fill="none" opacity=".25"/>
          <path d="M 100,166 C 250,166 260,180 410,180" stroke="var(--c-info)" strokeWidth="22" fill="none" opacity=".3"/>
          <path d="M 490,180 C 640,180 650,170 800,170" stroke="var(--c-info)" strokeWidth="20" fill="none" opacity=".3"/>
          <path d="M 100,266 C 250,266 260,235 410,235" stroke="var(--c-danger)" strokeWidth="14" fill="none" opacity=".3"/>
          <path d="M 490,235 C 640,235 650,225 800,225" stroke="var(--c-danger)" strokeWidth="14" fill="none" opacity=".3"/>

          {/* Anomaly arrow */}
          <path d="M 490,110 C 640,110 650,225 800,225" stroke="var(--c-danger)" strokeWidth="3" fill="none" strokeDasharray="6 4"/>
          <text x="660" y="180" fontSize="11" fontFamily="var(--font-mono)" fill="var(--c-danger)" fontWeight="600">⚠ 270 KG drift · RC-2417</text>

          {/* Stuck-in-interim callout */}
          <text x="450" y="148" fontSize="10" fontFamily="var(--font-mono)" fill="var(--c-warning)" textAnchor="middle" fontWeight="600">18 stuck &gt;6h</text>
          <circle cx="450" cy="64" r="14" fill="var(--c-warning)" opacity="0.2"/>
          <circle cx="450" cy="64" r="8" fill="var(--c-warning)"/>
          <text x="450" y="68" fontSize="9" fill="#fff" fontWeight="700" textAnchor="middle">!</text>

          <text x="450" y="320" fontSize="11" fill="var(--c-fg-mute)" textAnchor="middle">Bands sized by quantity · dashed = anomaly · pulse = aged interim stock</text>
        </svg>
      </div>
    </div>
  );
}

window.Recon = Recon;
