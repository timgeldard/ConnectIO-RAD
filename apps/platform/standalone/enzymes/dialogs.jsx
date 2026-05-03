/* Modal dialogs: Order Picker, Compare (before/after), Confirm & Audit. */

const OrderPicker = ({ orders, activeId, onSelect, onClose }) => {
  const [q, setQ] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const filtered = orders.filter(o =>
    (siteFilter === "all" || o.site === siteFilter) &&
    (q === "" || (o.id + o.product + o.sku).toLowerCase().includes(q.toLowerCase()))
  );
  const sites = ["all", ...Array.from(new Set(orders.map(o => o.site)))];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal lg" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>Open process order</h2>
            <p className="sub">Select an order to optimise its formula. {orders.length} orders ready across 3 sites.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div style={{ padding: "14px 24px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--stroke-soft)" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 10, top: 9, color: "var(--fg-muted)" }}><Icon name="search" /></span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by PO, SKU, or product…"
              style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--stroke)", borderRadius: 4, fontFamily: "inherit", fontSize: 13 }} />
          </div>
          <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--stroke)", borderRadius: 4, fontFamily: "inherit", fontSize: 13, background: "#fff" }}>
            {sites.map(s => <option key={s} value={s}>{s === "all" ? "All sites" : s}</option>)}
          </select>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <table className="data" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>PO</th><th>Product</th><th>Declared</th><th className="num">Qty</th>
                <th>Site / line</th><th>Due</th><th>Priority</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="row-hover" style={{ background: o.id === activeId ? "color-mix(in srgb, var(--valentia-slate) 7%, white)" : undefined }}>
                  <td><span className="num" style={{ fontWeight: 600 }}>{o.id}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.product}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{o.sku}</div>
                  </td>
                  <td className="num">{o.declared}</td>
                  <td className="num">{o.qty}</td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{o.site}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{o.line}</div>
                  </td>
                  <td className="num" style={{ fontSize: 12 }}>{o.due}</td>
                  <td><StatusBadge status={o.priority} /></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => onSelect(o)}>
                      Open <Icon name="right" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CompareDialog = ({ kpi, constraints, lots, diluents, onClose }) => {
  const cmpRows = [
    ...lots.map(l => ({
      label: l.id,
      kind: "Batch · " + l.activity + " NPU/g",
      before: l.proposed,
      after: l.suggested,
    })),
    ...diluents.map(d => ({
      label: d.name,
      kind: d.role,
      before: d.current,
      after: d.suggested,
    })),
  ];
  const maxVal = Math.max(...cmpRows.flatMap(r => [r.before, r.after]));
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal lg" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>Before vs After</h2>
            <p className="sub">Current order recipe compared to the optimised solution.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">

          <div className="stat-row" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 18 }}>
            {[
              ["Recipe cost", `€${kpi.current.cost.toLocaleString()}`, `€${kpi.optimised.cost.toLocaleString()}`, "down"],
              ["Yield to spec", `${kpi.current.yield}%`, `${kpi.optimised.yield}%`, "up"],
              ["Over-declaration", `${kpi.current.overDose}%`, `${kpi.optimised.overDose}%`, "down"],
              ["Diluent", `${kpi.current.diluentUse} kg`, `${kpi.optimised.diluentUse} kg`, "neutral"],
            ].map(([lbl, b, a, dir]) => (
              <div className="stat" key={lbl}>
                <div className="lbl">{lbl}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span className="num muted" style={{ fontSize: 14, textDecoration: "line-through", textDecorationColor: "var(--stone-300)" }}>{b}</span>
                  <Icon name="right" size={11} />
                  <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{a}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title">
            <h4>Components</h4>
            <span className="meta">kg per batch · before → after</span>
          </div>
          <table className="data diff-table">
            <thead>
              <tr><th>Component</th><th>Type</th><th className="num">Before</th><th></th><th className="num">After</th><th className="num">Δ</th></tr>
            </thead>
            <tbody>
              {cmpRows.map(r => {
                const delta = r.after - r.before;
                const dpct = ((delta) / (r.before || 1)) * 100;
                const cls = delta > 0 ? "pos" : delta < 0 ? "neg" : "nil";
                const sign = delta > 0 ? "+" : "";
                return (
                  <tr key={r.label}>
                    <td><span style={{ fontWeight: 600 }} className="mono">{r.label}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>{r.kind}</td>
                    <td className="num">{r.before} kg</td>
                    <td>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, minWidth: 160 }}>
                        <div className="bar-cell"><div className="bar" style={{ width: `${(r.before / maxVal) * 100}%` }} /></div>
                        <div className="bar-cell"><div className="bar opt" style={{ width: `${(r.after / maxVal) * 100}%` }} /></div>
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.after} kg</td>
                    <td className="num">
                      <span className={`delta-pill ${cls}`}>{sign}{delta} kg{r.before ? ` · ${sign}${dpct.toFixed(0)}%` : ""}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="divider" />

          <div className="section-title">
            <h4>Constraint outcomes</h4>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Constraint</th>
                <th>Allowed</th>
                <th className="num">Before</th>
                <th className="num">After</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map(c => {
                const before = c.current, after = c.optimised;
                const wasViol = before < c.min || before > c.max;
                const nowOk = after >= c.min && after <= c.max;
                return (
                  <tr key={c.id}>
                    <td><div style={{ fontWeight: 600 }}>{c.name}</div><div className="muted" style={{ fontSize: 11 }}>{c.unit}</div></td>
                    <td className="num muted" style={{ fontSize: 12 }}>{c.min} – {c.max}</td>
                    <td className="num" style={{ color: wasViol ? "#8B2900" : undefined, fontWeight: wasViol ? 600 : 400 }}>{before}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{after}</td>
                    <td>{nowOk ? <Badge kind="success" dot>Within spec</Badge> : <Badge kind="error" dot>Violation</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="modal-foot">
          <span className="muted" style={{ fontSize: 12 }}>Diff frozen at run · 14:32 UTC</span>
          <div className="flex gap-12">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn btn-secondary">Export as PDF</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const ConfirmDialog = ({ kpi, onClose, onAccept }) => {
  const [reason, setReason] = React.useState("act-recovery");
  const [note, setNote] = React.useState("");
  const [signed, setSigned] = React.useState(false);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 640 }}>
        <header className="modal-head">
          <div>
            <h2>Accept &amp; post recipe</h2>
            <p className="sub">Writes the optimised formula to the process order and creates an audit record.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">
          <div style={{ background: "var(--stone)", borderRadius: 8, padding: 16, marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Summary of change</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase" }}>Cost</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>€{kpi.optimised.cost.toLocaleString()}</div>
                <div className="delta up" style={{ fontSize: 12 }}>▼ €{kpi.current.cost - kpi.optimised.cost} vs current</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase" }}>Over-declaration</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{kpi.optimised.overDose}%</div>
                <div className="delta up" style={{ fontSize: 12 }}>▼ {(kpi.current.overDose - kpi.optimised.overDose).toFixed(1)} pts</div>
              </div>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Reason code</label>
          <select value={reason} onChange={e => setReason(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--stroke)", borderRadius: 4, fontFamily: "inherit", fontSize: 13, background: "#fff", marginBottom: 14 }}>
            {REASON_CODES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Notes for audit log</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows="3" placeholder="Optional. Reference customer ticket, COA exception, or supervisor approval."
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--stroke)", borderRadius: 4, fontFamily: "inherit", fontSize: 13, marginBottom: 14, resize: "vertical" }} />

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, padding: "10px 12px", background: "var(--stone)", borderRadius: 4 }}>
            <input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--valentia-slate)" }} />
            <span>I confirm this recipe meets customer specification and have reviewed all binding constraints. My e-signature will be attached to PO-4471290.</span>
          </label>
        </div>
        <footer className="modal-foot">
          <span className="muted" style={{ fontSize: 12 }}><Icon name="lock" size={11} /> Posts to SAP via PEX-E-90 batch service</span>
          <div className="flex gap-12">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-accept" disabled={!signed} onClick={onAccept}>
              <Icon name="check" /> Accept &amp; post
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

Object.assign(window, { OrderPicker, CompareDialog, ConfirmDialog });
