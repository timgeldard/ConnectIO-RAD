// ============================================================================
// Right-side detail drawer for orders / notifications
// ============================================================================
const DetailDrawer = ({ item, onClose }) => {
  const D = window.PMData;
  if (!item) return null;
  if (item.type === "order") return <OrderDrawer id={item.id} onClose={onClose}/>;
  if (item.type === "notif") return <NotifDrawer id={item.id} onClose={onClose}/>;
  return null;
};

const OrderDrawer = ({ id, onClose }) => {
  const D = window.PMData;
  const o = D.ORDERS.find(o => o.id === id) || D.ORDERS[0];
  const ops = id === "WO-501221" ? D.OPERATIONS_501221 : D.OPERATIONS_501221.slice(0, 4);
  return (
    <>
      <div className="drawer-head">
        <div className="vstack" style={{gap: 4, flex: 1}}>
          <div className="hstack gap-2">
            <span className="text-mono text-xs muted">{o.id}</span>
            <Prio p={o.prio}/>
            <Sev tone="info" dot={false}>{o.type}</Sev>
          </div>
          <h2 style={{margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink-strong)", lineHeight: 1.3}}>{o.desc}</h2>
          <div className="text-sm muted">{o.equip} · {o.floc}</div>
        </div>
        <div className="hstack gap-2">
          <button className="btn btn-ghost btn-icon btn-sm"><Icon name="open" size={14}/></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
      </div>

      <div className="drawer-section">
        <div className="label-row">
          <div className="section-eyebrow">Pipeline</div>
        </div>
        <Pipeline steps={o.pipeline} current={o.stage}/>
        <div className="hstack" style={{marginTop: 12, gap: 14, fontSize: 12}}>
          <div className="vstack" style={{gap: 2}}>
            <div className="text-xs muted">Due</div>
            <div className="text-mono" style={{fontWeight: 600, color: o.overdue ? "var(--critical)" : "var(--ink-strong)"}}>{o.due}</div>
          </div>
          <div className="vstack" style={{gap: 2}}>
            <div className="text-xs muted">Work center</div>
            <div className="text-mono" style={{fontWeight: 600}}>{o.wc}</div>
          </div>
          <div className="vstack" style={{gap: 2}}>
            <div className="text-xs muted">Planner</div>
            <div className="hstack" style={{gap: 6}}>
              <Avatar initials={o.planner.split(" ").map(n => n[0]).join("")} name={o.planner} sm/>
              <span style={{fontSize: 12}}>{o.planner.split(" ")[0]}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="drawer-section">
        <div className="label-row">
          <div className="section-eyebrow">Effort & cost</div>
          <span className="text-mono text-xs muted">USD</span>
        </div>
        <div className="grid cols-2" style={{gap: 10}}>
          <div className="vstack" style={{gap: 4}}>
            <div className="text-xs muted">Hours · planned vs actual</div>
            <div className="hstack" style={{gap: 6, alignItems: "baseline"}}>
              <span className="text-mono" style={{fontSize: 16, fontWeight: 600, color: "var(--ink-strong)"}}>{o.actual_h || 0}h</span>
              <span className="text-xs muted">of {o.planned_h}h</span>
            </div>
            <div className="bar"><span style={{width: Math.min(100, ((o.actual_h || 0) / o.planned_h) * 100) + "%", background: "var(--valentia-slate)"}}/></div>
          </div>
          <div className="vstack" style={{gap: 4}}>
            <div className="text-xs muted">Cost · planned vs actual</div>
            <div className="hstack" style={{gap: 6, alignItems: "baseline"}}>
              <span className="text-mono" style={{fontSize: 16, fontWeight: 600, color: "var(--ink-strong)"}}>${(o.actual_cost || 0).toLocaleString()}</span>
              <span className="text-xs muted">of ${o.planned_cost.toLocaleString()}</span>
            </div>
            <div className="bar"><span style={{width: Math.min(100, ((o.actual_cost || 0) / o.planned_cost) * 100) + "%", background: "var(--chart-2)"}}/></div>
          </div>
        </div>
      </div>

      <div className="drawer-section">
        <div className="label-row">
          <div className="section-eyebrow">Operations</div>
          <span className="text-mono text-xs muted">{ops.length} steps</span>
        </div>
        <div className="vstack" style={{gap: 6}}>
          {ops.map((op, i) => (
            <div key={op.id} className="hstack" style={{gap: 10, padding: "6px 0", borderBottom: i < ops.length - 1 ? "1px solid var(--border-1)" : "none"}}>
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                display: "grid", placeItems: "center", flexShrink: 0,
                background: op.status === "done" ? "var(--ok)" : op.status === "active" ? "var(--valentia-slate)" : "var(--surface-sunken)",
                color: op.status === "todo" ? "var(--ink-3)" : "white",
                fontSize: 10, fontWeight: 600
              }}>
                {op.status === "done" ? <Icon name="check" size={11}/> : op.status === "active" ? <Icon name="clock" size={11}/> : ""}
              </div>
              <span className="text-mono text-xs muted" style={{width: 30}}>{op.id}</span>
              <span className="flex-1" style={{fontSize: 12, color: op.status === "done" ? "var(--ink-3)" : "var(--ink)", textDecoration: op.status === "done" ? "line-through" : "none"}}>{op.desc}</span>
              <span className="text-mono text-xs muted">{op.wc}</span>
              <span className="text-mono text-xs" style={{fontWeight: 500}}>{op.duration}h</span>
            </div>
          ))}
        </div>
      </div>

      <div className="drawer-section">
        <div className="label-row">
          <div className="section-eyebrow">Linked notification</div>
        </div>
        {o.notif ? (
          <div className="hstack" style={{gap: 8, padding: 10, border: "1px solid var(--border-1)", borderRadius: 6}}>
            <Icon name="bell" size={14} style={{color: "var(--watch)"}}/>
            <div className="vstack" style={{flex: 1, gap: 2}}>
              <span className="text-mono text-xs">{o.notif}</span>
              <span className="text-xs muted">Reported breakdown · 8h ago</span>
            </div>
            <Icon name="chevR" size={14} style={{color: "var(--ink-4)"}}/>
          </div>
        ) : (
          <div className="text-sm muted">No notification linked.</div>
        )}
      </div>

      <div className="drawer-section">
        <div className="hstack gap-2">
          <button className="btn btn-primary btn-sm" style={{flex: 1}}><Icon name="check" size={13}/>Confirm operation</button>
          <button className="btn btn-sm"><Icon name="edit" size={13}/></button>
          <button className="btn btn-sm"><Icon name="more" size={13}/></button>
        </div>
      </div>
    </>
  );
};

const NotifDrawer = ({ id, onClose }) => {
  const D = window.PMData;
  const n = D.NOTIFICATIONS.find(x => x.id === id) || D.NOTIFICATIONS[0];
  return (
    <>
      <div className="drawer-head">
        <div className="vstack" style={{gap: 4, flex: 1}}>
          <div className="hstack gap-2">
            <span className="text-mono text-xs muted">{n.id}</span>
            <Prio p={n.prio}/>
            <Sev tone={n.type === "Breakdown" ? "critical" : "neutral"} dot={false}>{n.type}</Sev>
          </div>
          <h2 style={{margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink-strong)", lineHeight: 1.3}}>{n.desc}</h2>
          <div className="text-sm muted">{n.equip} · {n.floc}</div>
        </div>
        <div className="hstack gap-2">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
      </div>
      <div className="drawer-section">
        <div className="grid cols-2" style={{gap: 12}}>
          <div className="vstack" style={{gap: 2}}><div className="text-xs muted">Reported</div><div style={{fontSize: 12}}>{n.reportedAt.replace("T", " ")}</div></div>
          <div className="vstack" style={{gap: 2}}><div className="text-xs muted">By</div><div style={{fontSize: 12}}>{n.reportedBy}</div></div>
          <div className="vstack" style={{gap: 2}}><div className="text-xs muted">Age</div><div className="text-mono" style={{fontSize: 12}}>{n.age_h}h</div></div>
          <div className="vstack" style={{gap: 2}}><div className="text-xs muted">Status</div><Sev tone="info" dot={false}>{n.status}</Sev></div>
        </div>
      </div>
      <div className="drawer-section">
        <div className="section-eyebrow" style={{marginBottom: 8}}>Linked order</div>
        {n.order ? <a className="hstack" style={{gap: 6, fontSize: 13}}><Icon name="wrench" size={13}/>{n.order}</a> : <div className="text-sm muted">No order yet — convert to order →</div>}
      </div>
      <div className="drawer-section">
        <button className="btn btn-primary btn-sm" style={{width: "100%"}}><Icon name="wrench" size={13}/>Convert to order</button>
      </div>
    </>
  );
};

window.DetailDrawer = DetailDrawer;
