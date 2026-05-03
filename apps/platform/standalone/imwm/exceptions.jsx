// exceptions.jsx — Inventory Exceptions queue
const { Icon, Kpi, SeverityBar } = window.UI;

function Exceptions({ onOpenItem }) {
  const D = window.__INV_DATA__;
  const [filter, setFilter] = React.useState("all");
  const [bulk, setBulk] = React.useState({});

  const items = D.EXCEPTIONS.filter(e => filter === "all" ? true : filter === "sev4" ? e.severity === 4 : filter === "sev3" ? e.severity === 3 : filter === "open" ? e.status === "open" : filter === "mine" ? e.owner === "S. Murphy" : true);

  const sev4 = D.EXCEPTIONS.filter(e => e.severity === 4).length;
  const slaBreach = D.EXCEPTIONS.filter(e => e.age_h > e.sla_h && e.sla_h > 0).length;
  const unassigned = D.EXCEPTIONS.filter(e => e.owner === "Unassigned").length;
  const bulkCount = Object.values(bulk).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "var(--gap)" }}>
        <Kpi label="Active exceptions" value="12" foot={<span>3 SEV-4 · 4 SEV-3</span>}/>
        <Kpi label="SLA breached" accent="danger" value={slaBreach.toString()} foot={<span>oldest 240h</span>}/>
        <Kpi label="Unassigned" accent="warning" value={unassigned.toString()} foot={<span>auto-route in 1h</span>}/>
        <Kpi label="MTTR · 7d" accent="success" value="3.4h" delta="-0.8h" deltaDir="down"/>
        <Kpi label="Auto-cleared · 7d" value="184" foot={<span>78% of total</span>}/>
      </div>

      <div className="card">
        <div className="tbl-toolbar">
          <div className="left">
            <div className="btn-group">
              {[["all","All",12],["sev4","SEV-4",3],["sev3","SEV-3",4],["open","Open",10],["mine","Assigned to me",4]].map(([k,l,c]) => (
                <button key={k} className={`btn ${filter===k?"active":""}`} onClick={()=>setFilter(k)}>{l}<span style={{ marginLeft: 4, opacity: .7, fontFamily:"var(--font-mono)" }}>{c}</span></button>
              ))}
            </div>
            {bulkCount > 0 && (
              <>
                <div style={{ width: 1, height: 18, background: "var(--c-stroke)" }}/>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{bulkCount} selected</span>
                <button className="btn btn-ghost btn-sm">Assign…</button>
                <button className="btn btn-ghost btn-sm">Acknowledge</button>
                <button className="btn btn-danger btn-sm">Escalate</button>
              </>
            )}
          </div>
          <div className="right">
            <div className="tbl-search">
              <Icon name="search" size={14}/>
              <input placeholder="Search exception, owner, material…"/>
            </div>
            <button className="btn btn-ghost btn-sm"><Icon name="download"/>Export</button>
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ width: 54 }}>Sev</th>
              <th style={{ width: 80 }}>ID</th>
              <th>Type</th>
              <th>Material / Site</th>
              <th>Detail</th>
              <th>SLA</th>
              <th>Age</th>
              <th>Owner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(e => {
              const breach = e.sla_h > 0 && e.age_h > e.sla_h;
              return (
                <tr key={e.id} onClick={() => onOpenItem(e)}>
                  <td style={{ paddingLeft: 12 }}>
                    <input type="checkbox" checked={!!bulk[e.id]} onClick={ev=>ev.stopPropagation()} onChange={ev=>setBulk({...bulk,[e.id]:ev.target.checked})}/>
                  </td>
                  <td><SeverityBar level={e.severity}/></td>
                  <td className="code">{e.id}</td>
                  <td><span style={{ fontWeight: 600, fontSize: 12 }}>{e.type}</span></td>
                  <td>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e.material === "—" ? <span style={{ color: "var(--c-fg-faint)" }}>—</span> : e.material}</div>
                    <div style={{ fontSize: 11, color: "var(--c-fg-mute)" }}>{e.plant} {e.sloc !== "—" && "· " + e.sloc}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--c-fg-mute)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.details}</td>
                  <td>
                    {e.sla_h > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: breach ? "var(--c-danger)" : "var(--c-fg)", fontWeight: breach ? 600 : 400 }}>{e.sla_h}h</span>
                        {breach && <span className="badge danger" style={{ fontSize: 9 }}>Breach</span>}
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: e.age_h > 48 ? "var(--c-danger)" : e.age_h > 24 ? "var(--c-warning)" : "var(--c-fg)", fontWeight: 600 }}>{e.age_h}h</span></td>
                  <td style={{ fontSize: 12 }}>{e.owner === "Unassigned" ? <span style={{ color: "var(--c-warning)" }}>· Unassigned</span> : e.owner}</td>
                  <td>
                    <span className={`badge ${e.status === "open" ? "warning" : e.status === "in-progress" ? "info" : "muted"}`}>
                      <span className="dot"/>{e.status}
                    </span>
                  </td>
                  <td><Icon name="chevRight" size={14} style={{ color: "var(--c-fg-mute)" }}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Exceptions = Exceptions;
