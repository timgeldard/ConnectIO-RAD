// im.jsx — IM Inventory Explorer

const { Icon, Sparkline, Kpi, MismatchBadge, StockTypeBadge, Money, K, Bar } = window.UI;

function IMExplorer({ rows, persona, onOpenItem }) {
  const D = window.__INV_DATA__;
  const [selected, setSelected] = React.useState(null);
  const [expanded, setExpanded] = React.useState({});
  const [sort, setSort] = React.useState({ key: "im_total", dir: "desc" });
  const [search, setSearch] = React.useState("");

  // group rows by material
  const grouped = React.useMemo(() => {
    const out = {};
    rows.forEach(r => {
      const k = r.material;
      if (!out[k]) out[k] = { material: r.material, desc: r.desc, mtype: r.mtype, uom: r.uom, abc: r.abc, xyz: r.xyz, rows: [], unrestricted:0, qi:0, blocked:0, restricted:0, interim:0, im_total:0, wm_total:0, value_eur:0 };
      out[k].rows.push(r);
      out[k].unrestricted += r.unrestricted;
      out[k].qi += r.qi;
      out[k].blocked += r.blocked;
      out[k].restricted += r.restricted;
      out[k].interim += r.interim;
      out[k].im_total += r.im_total;
      out[k].wm_total += r.wm_total;
      out[k].value_eur += r.value_eur;
    });
    let arr = Object.values(out);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(r => r.material.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
    }
    arr.sort((a,b) => {
      const dir = sort.dir === "desc" ? -1 : 1;
      return ((a[sort.key] > b[sort.key] ? 1 : -1)) * dir;
    });
    return arr;
  }, [rows, sort, search]);

  const totalLines = grouped.length;
  const totalValue = grouped.reduce((s,r) => s + r.value_eur, 0);
  const totalIM = grouped.reduce((s,r) => s + r.im_total, 0);
  const totalQI = grouped.reduce((s,r) => s + r.qi, 0);
  const totalBlocked = grouped.reduce((s,r) => s + r.blocked, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="Materials in Scope" value={totalLines.toString()} foot={<span>across 5 plants · 6 sloc</span>}/>
        <Kpi label="Total IM On-Hand" accent="brand" value={K(totalIM)} unit="KG" delta="+2.1%" deltaDir="up" trend={D.makeTrend(1, totalIM/100, 0.02)}/>
        <Kpi label="Stock Value" accent="success" value={Money(totalValue)} delta="+€38K" deltaDir="up"/>
        <Kpi label="In QI" accent="warning" value={K(totalQI)} unit="KG" foot={<span>{((totalQI/totalIM)*100).toFixed(1)}% of total</span>}/>
        <Kpi label="Blocked" accent="danger" value={K(totalBlocked)} unit="KG" foot={<span>Disposition pending</span>}/>
      </div>

      {/* Toolbar + table */}
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="tbl-toolbar">
          <div className="left">
            <div className="tbl-search">
              <Icon name="search" size={14}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter material code or description…"/>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-mute)" }}>
              {grouped.length} materials · {rows.length} stock lines
            </span>
          </div>
          <div className="right">
            <div className="btn-group">
              <button className="btn active">By Material</button>
              <button className="btn">By Plant</button>
              <button className="btn">By Storage Loc</button>
            </div>
            <button className="btn btn-ghost btn-sm"><Icon name="filter"/>Columns</button>
            <button className="btn btn-ghost btn-sm"><Icon name="download"/>Export</button>
          </div>
        </div>

        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 360px)" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Material</th>
                <th>Type</th>
                <th>ABC/XYZ</th>
                <th className="num">IM Total</th>
                <th>Stock Status Split</th>
                <th className="num">WM Total</th>
                <th className="num">Δ</th>
                <th className="num">Value</th>
                <th>Plants</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g, i) => {
                const exp = expanded[g.material];
                const delta = g.wm_total - g.im_total;
                return (
                  <React.Fragment key={g.material}>
                    <tr className={selected === g.material ? "selected" : ""}
                        onClick={() => { setSelected(g.material); }}>
                      <td>
                        <button className="icon-btn" style={{ width: 22, height: 22 }}
                                onClick={(e) => { e.stopPropagation(); setExpanded({ ...expanded, [g.material]: !exp }); }}>
                          <Icon name={exp ? "chevDown" : "chevRight"} size={12}/>
                        </button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 12 }}>{g.material}</div>
                        <div style={{ fontSize: 11, color: "var(--c-fg-mute)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.desc}</div>
                      </td>
                      <td><span className="badge muted">{g.mtype}</span></td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                          <span style={{ color: g.abc === "A" ? "var(--c-danger)" : g.abc === "B" ? "var(--c-warning)" : "var(--c-fg-mute)" }}>{g.abc}</span>
                          <span style={{ color: "var(--c-fg-faint)" }}>/</span>
                          <span style={{ color: g.xyz === "X" ? "var(--c-success)" : g.xyz === "Y" ? "var(--c-warning)" : "var(--c-danger)" }}>{g.xyz}</span>
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{K(g.im_total)}<span style={{ color: "var(--c-fg-mute)", marginLeft: 3, fontSize: 10 }}>{g.uom}</span></td>
                      <td>
                        <div className="stack-bar" style={{ width: 140, height: 8 }}>
                          {g.unrestricted > 0 && <span style={{ width: (g.unrestricted/g.im_total)*100 + "%", background: "var(--c-success)" }} title={`Unrestricted ${K(g.unrestricted)}`}/>}
                          {g.qi > 0 && <span style={{ width: (g.qi/g.im_total)*100 + "%", background: "var(--c-info)" }} title={`QI ${K(g.qi)}`}/>}
                          {g.interim > 0 && <span style={{ width: (g.interim/g.im_total)*100 + "%", background: "var(--c-purple)" }} title={`Interim ${K(g.interim)}`}/>}
                          {g.restricted > 0 && <span style={{ width: (g.restricted/g.im_total)*100 + "%", background: "var(--c-warning)" }} title={`Restricted ${K(g.restricted)}`}/>}
                          {g.blocked > 0 && <span style={{ width: (g.blocked/g.im_total)*100 + "%", background: "var(--c-danger)" }} title={`Blocked ${K(g.blocked)}`}/>}
                        </div>
                      </td>
                      <td className="num">{K(g.wm_total)}</td>
                      <td className="num" style={{ color: delta === 0 ? "var(--c-fg-mute)" : Math.abs(delta) > g.im_total*0.02 ? "var(--c-danger)" : "var(--c-warning)", fontWeight: 600 }}>
                        {delta > 0 ? "+" : ""}{delta === 0 ? "—" : K(delta)}
                      </td>
                      <td className="num" style={{ color: "var(--c-fg)" }}>{Money(g.value_eur)}</td>
                      <td><span className="badge muted">{g.rows.length} loc</span></td>
                    </tr>
                    {exp && g.rows.map(r => (
                      <tr key={r.id} style={{ background: "var(--c-bg)" }}
                          onClick={() => onOpenItem(r)}>
                        <td></td>
                        <td colSpan={3} style={{ paddingLeft: 32 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                            <Icon name="factory" size={12} style={{ color: "var(--c-fg-mute)" }}/>
                            <span className="code">{r.plant}</span>
                            <span style={{ color: "var(--c-fg-mute)" }}>{r.plantName}</span>
                            <span className="badge muted">{r.storageLoc}</span>
                            <span style={{ color: "var(--c-fg-mute)", fontSize: 10 }}>{r.storageLocName}</span>
                          </div>
                        </td>
                        <td className="num">{K(r.im_total)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {r.unrestricted > 0 && <span className="badge success" style={{ fontSize: 9 }}>{K(r.unrestricted)}</span>}
                            {r.qi > 0 && <span className="badge info" style={{ fontSize: 9 }}>QI {K(r.qi)}</span>}
                            {r.blocked > 0 && <span className="badge danger" style={{ fontSize: 9 }}>BL {K(r.blocked)}</span>}
                            {r.interim > 0 && <span className="badge purple" style={{ fontSize: 9 }}>INT {K(r.interim)}</span>}
                          </div>
                        </td>
                        <td className="num">{K(r.wm_total)}</td>
                        <td className="num" style={{ color: r.delta === 0 ? "var(--c-fg-mute)" : "var(--c-danger)" }}>
                          {r.delta > 0 ? "+" : ""}{r.delta === 0 ? "—" : K(r.delta)}
                        </td>
                        <td className="num">{Money(r.value_eur)}</td>
                        <td>{r.batches > 0 && <span className="badge muted">{r.batches}b</span>}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.IMExplorer = IMExplorer;
