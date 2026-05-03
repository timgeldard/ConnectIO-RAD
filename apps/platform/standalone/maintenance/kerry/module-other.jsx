// ============================================================================
// Module: Asset / Equipment Health Explorer
// ============================================================================
const AssetHealth = ({ onOpen, onNav }) => {
  const D = window.PMData;
  const a = D.ASSET_DRY02;
  const [tab, setTab] = React.useState("overview");

  return (
    <div className="vstack" style={{gap: 16}}>
      <div className="hstack" style={{gap: 8, fontSize: 12, color: "var(--ink-3)"}}>
        <a onClick={() => onNav("reliability")} style={{cursor: "pointer"}}>Asset Health</a>
        <Icon name="chevR" size={11}/>
        <span>BLT · Process Hall</span>
        <Icon name="chevR" size={11}/>
        <span style={{color: "var(--ink)"}}>Spray Dryer #2</span>
      </div>

      <div className="card">
        <div className="card-pad" style={{padding: 20}}>
          <div className="hstack between" style={{flexWrap: "wrap", gap: 16}}>
            <div className="hstack" style={{gap: 18}}>
              <div style={{
                width: 56, height: 56,
                background: "color-mix(in srgb, var(--valentia-slate) 12%, white)",
                color: "var(--valentia-slate)",
                borderRadius: 8,
                display: "grid", placeItems: "center"
              }}>
                <Icon name="chip" size={28}/>
              </div>
              <div className="vstack" style={{gap: 4}}>
                <div className="hstack gap-2">
                  <span className="text-mono text-xs muted">{a.id}</span>
                  <Sev tone="critical">Criticality A</Sev>
                  <Sev tone="watch">Active breakdown</Sev>
                </div>
                <h1 className="page-title" style={{margin: 0}}>{a.name}</h1>
                <div className="text-sm muted">{a.type} · {a.manufacturer} · in service {a.service_age_y}y · {a.parent}</div>
              </div>
            </div>
            <div className="hstack gap-2">
              <button className="btn btn-sm"><Icon name="bell" size={13}/>Notify</button>
              <button className="btn btn-sm"><Icon name="history" size={13}/>Full history</button>
              <button className="btn btn-primary btn-sm"><Icon name="wrench" size={13}/>Create order</button>
            </div>
          </div>

          <div className="grid cols-6" style={{marginTop: 20, gap: 0, border: "1px solid var(--border-1)", borderRadius: 6, overflow: "hidden"}}>
            {[
              { label: "Availability · 30d", value: a.reliability.availability + "%", tone: "watch" },
              { label: "MTBF", value: a.reliability.mtbf + " h", tone: "critical" },
              { label: "MTTR", value: a.reliability.mttr + " h", tone: "watch" },
              { label: "Failures · 30d", value: a.reliability.failures_30d, tone: "critical" },
              { label: "PM compliance", value: a.pm_compliance + "%", tone: "watch" },
              { label: "Open work", value: `${a.open_orders} / ${a.open_notifs}`, tone: "neutral", sub: "orders / notifs" },
            ].map((s, i) => (
              <div key={i} style={{padding: 14, borderRight: i < 5 ? "1px solid var(--border-1)" : "none", background: "var(--surface-panel)"}}>
                <div className="text-xs muted" style={{marginBottom: 4}}>{s.label}</div>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600,
                  color: s.tone === "critical" ? "var(--critical)" : s.tone === "watch" ? "var(--watch)" : "var(--ink-strong)",
                  letterSpacing: "-0.02em", lineHeight: 1
                }}>{s.value}</div>
                {s.sub && <div className="text-xs muted" style={{marginTop: 2}}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        {value: "overview", label: "Overview"},
        {value: "open", label: "Open work", count: 5},
        {value: "history", label: "Work & failure history", count: 47},
        {value: "trend", label: "Measuring points"},
      ]}/>

      {tab === "overview" && (
        <div className="grid cols-12">
          <div className="card span-7">
            <div className="card-header">
              <div className="vstack" style={{gap: 2}}>
                <span className="section-eyebrow">Last 12 months</span>
                <span className="section-title">Reliability summary</span>
              </div>
            </div>
            <div className="card-pad">
              <LineChart
                w={620} h={200}
                series={[
                  { name: "MTBF", color: "var(--chart-1)", data: [220,210,205,195,185,175,165,150,140,120,100,78] },
                ]}
                xLabels={["Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May"]}
                fmt={(v) => v.toFixed(0) + "h"}
                threshold={150}
              />
              <div style={{marginTop: 12, padding: 10, background: "var(--critical-bg)", border: "1px solid var(--critical-border)", borderRadius: 6, fontSize: 12, color: "var(--ink)"}}>
                <strong style={{color: "var(--critical)"}}>MTBF degrading rapidly</strong> — dropped from 220h to 78h in 12 months. Bearing recurrence pattern. RCA opened on 4/28.
              </div>
            </div>
          </div>
          <div className="card span-5">
            <div className="card-header">
              <div className="vstack" style={{gap: 2}}>
                <span className="section-eyebrow">Vibration sensor · VIB-DRY02-01</span>
                <span className="section-title">Measuring point trend</span>
              </div>
            </div>
            <div className="card-pad">
              <LineChart
                w={420} h={200}
                series={[
                  { name: "Vibration mm/s", color: "var(--critical)", data: a.vib },
                ]}
                xLabels={["Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Now"]}
                fmt={(v) => v.toFixed(1)}
                threshold={4.5}
              />
              <div className="hstack" style={{marginTop: 8, fontSize: 11, color: "var(--ink-3)"}}>
                <span>Last reading</span>
                <span className="text-mono" style={{marginLeft: 6, color: "var(--critical)", fontWeight: 600}}>6.2 mm/s</span>
                <div style={{flex: 1}}/>
                <span>Alarm at 4.5 mm/s</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === "history" || tab === "open") && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width: 90}}>Date</th>
                <th style={{width: 110}}>Order</th>
                <th>Description</th>
                <th style={{width: 110}}>Type</th>
                <th style={{width: 90, textAlign: "right"}}>Hours</th>
                <th style={{width: 90, textAlign: "right"}}>Cost</th>
                <th style={{width: 100}}>Failure</th>
              </tr>
            </thead>
            <tbody>
              {a.history.map(h => (
                <tr key={h.id} onClick={() => onOpen({type: "order", id: h.id})}>
                  <td className="text-mono text-xs">{h.date}</td>
                  <td className="id">{h.id}</td>
                  <td>{h.desc}</td>
                  <td className="text-sm muted">{h.type}</td>
                  <td className="num">{h.h}</td>
                  <td className="num">${h.cost.toLocaleString()}</td>
                  <td>{h.fm ? <Sev tone="watch" dot={false}>{h.fm}</Sev> : <span className="muted text-xs">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "trend" && (
        <Empty title="Measuring point trend" sub="Connect IoT or BMS feed to render historic counters and condition trends." icon="activity"
          action={<button className="btn btn-sm" style={{marginTop: 8}}>Connect data source</button>}/>
      )}
    </div>
  );
};

// ============================================================================
// Module: Notification Explorer
// ============================================================================
const Notifications = ({ onOpen }) => {
  const D = window.PMData;
  return (
    <div className="vstack" style={{gap: 16}}>
      <PageHeader eyebrow="Work" title="Notification Explorer"
        sub="Track reported issues, conversion to orders, and dominant failure modes."
        right={<button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/>New notification</button>}/>

      <div className="grid cols-4">
        <KPICard label="Open notifications" value={89} unit="" trend="+12" dir="up-bad" status="watch"/>
        <KPICard label="Outstanding · no order" value={14} unit="" trend="+3" dir="up-bad" status="critical"/>
        <KPICard label="Avg conversion time" value={8.2} unit="hrs" trend="-1.4h" dir="down-good" status="ok"/>
        <KPICard label="Breakdowns · 7d" value={11} unit="" trend="+4" dir="up-bad" status="critical"/>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="hstack gap-2">
            <Chip active>All <span className="count">{D.NOTIFICATIONS.length}</span></Chip>
            <Chip>Breakdowns <span className="count">4</span></Chip>
            <Chip>Outstanding <span className="count">2</span></Chip>
            <Chip>P1+P2 <span className="count">7</span></Chip>
          </div>
          <div className="hstack gap-2">
            <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13}/>Filter</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 40}}>Pri</th>
              <th style={{width: 130}}>Notif #</th>
              <th style={{width: 110}}>Type</th>
              <th>Description</th>
              <th style={{width: 160}}>Equipment</th>
              <th style={{width: 60, textAlign: "right"}}>Age</th>
              <th style={{width: 110}}>Order</th>
              <th style={{width: 110}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {D.NOTIFICATIONS.map(n => (
              <tr key={n.id} onClick={() => onOpen({type: "notif", id: n.id})}>
                <td><Prio p={n.prio}/></td>
                <td className="id">{n.id}</td>
                <td className="text-sm">
                  <Sev tone={n.type === "Breakdown" ? "critical" : n.type === "Quality" ? "watch" : "neutral"} dot={false}>{n.type}</Sev>
                </td>
                <td>{n.desc}</td>
                <td className="text-sm" style={{color: "var(--ink-2)"}}>{n.equip}</td>
                <td className="num text-xs">{n.age_h}h</td>
                <td className="id">{n.order || <span className="muted">—</span>}</td>
                <td><Sev tone={n.status === "Resolved" ? "ok" : n.status === "Outstanding" ? "critical" : "info"} dot={false}>{n.status}</Sev></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// Module: Order Explorer
// ============================================================================
const Orders = ({ onOpen }) => {
  const D = window.PMData;
  return (
    <div className="vstack" style={{gap: 16}}>
      <PageHeader eyebrow="Work" title="Maintenance Order Explorer"
        sub="Order pipeline, planned vs actual, and execution status across work centers."/>

      <div className="grid cols-4">
        <KPICard label="In progress" value={284} unit="" status="info"/>
        <KPICard label="Released · this week" value={142} unit="" status="ok"/>
        <KPICard label="Tech.completed · 7d" value={98} unit="" status="ok"/>
        <KPICard label="Variance > 25%" value={32} unit="orders" trend="+8" dir="up-bad" status="watch"/>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">Pipeline</span>
            <span className="section-title">Order status flow · this week</span>
          </div>
        </div>
        <div className="card-pad hstack" style={{gap: 0, justifyContent: "space-between", alignItems: "stretch"}}>
          {[
            { label: "Created", count: 47, tone: "var(--ink-3)" },
            { label: "Released", count: 142, tone: "var(--info)" },
            { label: "In progress", count: 284, tone: "var(--valentia-slate)" },
            { label: "Confirmed", count: 156, tone: "var(--chart-2)" },
            { label: "Tech.Comp", count: 98, tone: "var(--ok)" },
            { label: "Closed", count: 412, tone: "var(--ink-3)" },
          ].map((s, i, arr) => (
            <React.Fragment key={i}>
              <div className="vstack" style={{flex: 1, gap: 4, padding: 12, alignItems: "center"}}>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 600,
                  color: s.tone, letterSpacing: "-0.02em", lineHeight: 1
                }}>{s.count}</div>
                <div className="text-xs muted">{s.label}</div>
              </div>
              {i < arr.length - 1 && <div style={{display: "grid", placeItems: "center", color: "var(--ink-4)"}}><Icon name="chevR" size={14}/></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="hstack gap-2">
            <Chip active>All <span className="count">{D.ORDERS.length}</span></Chip>
            <Chip>In progress <span className="count">7</span></Chip>
            <Chip>Released <span className="count">4</span></Chip>
            <Chip>Variance &gt; 25% <span className="count">2</span></Chip>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 40}}>Pri</th>
              <th style={{width: 110}}>Order</th>
              <th style={{width: 110}}>Type</th>
              <th>Description</th>
              <th style={{width: 200}}>Pipeline</th>
              <th style={{width: 90, textAlign: "right"}}>Plan/Actual</th>
              <th style={{width: 90}}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {D.ORDERS.slice(0, 10).map(o => {
              const variance = o.actual_h && o.planned_h ? ((o.actual_h - o.planned_h) / o.planned_h * 100).toFixed(0) : null;
              return (
                <tr key={o.id} onClick={() => onOpen({type: "order", id: o.id})}>
                  <td><Prio p={o.prio}/></td>
                  <td className="id">{o.id}</td>
                  <td className="text-sm muted">{o.type}</td>
                  <td>{o.desc}</td>
                  <td><Pipeline steps={o.pipeline} current={o.stage}/></td>
                  <td className="num text-mono">{o.planned_h}h / {o.actual_h || "—"}h</td>
                  <td>
                    {variance !== null && (
                      <Sev tone={Math.abs(variance) > 25 ? "watch" : "ok"} dot={false}>
                        {variance >= 0 ? "+" : ""}{variance}%
                      </Sev>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// Module: Exceptions
// ============================================================================
const Exceptions = ({ onOpen }) => {
  const D = window.PMData;
  return (
    <div className="vstack" style={{gap: 16}}>
      <PageHeader eyebrow="Governance" title="Maintenance Exceptions"
        sub="Structurally problematic items: overdue work, missing data, repeat failures, and SLA breaches."/>

      <AlertStrip tone="critical" icon="alert">
        <strong>91 exceptions</strong> — 33 high severity. Estimated effort to clear: 4 planner-days. Oldest exception is 104 days old.
      </AlertStrip>

      <div className="grid cols-4">
        <KPICard label="High severity" value={33} unit="" status="critical"/>
        <KPICard label="Medium" value={25} unit="" status="watch"/>
        <KPICard label="Low" value={33} unit="" status="info"/>
        <KPICard label="Avg age" value={18} unit="days" status="watch"/>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="hstack gap-2">
            <Chip active>All <span className="count">{D.EXCEPTIONS.length}</span></Chip>
            <Chip>High <span className="count">4</span></Chip>
            <Chip>Overdue PM</Chip>
            <Chip>Repeat failures</Chip>
            <Chip>Master data gaps</Chip>
          </div>
          <div className="hstack gap-2">
            <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13}/>Group by reason</button>
            <button className="btn btn-sm"><Icon name="check" size={13}/>Bulk action</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 100}}>Severity</th>
              <th>Reason</th>
              <th style={{width: 70, textAlign: "right"}}>Count</th>
              <th style={{width: 130}}>Owner</th>
              <th style={{width: 90, textAlign: "right"}}>Oldest</th>
              <th style={{width: 180}}>Sample</th>
              <th style={{width: 130}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {D.EXCEPTIONS.map(e => (
              <tr key={e.id} onClick={() => {}}>
                <td>
                  <Sev tone={e.severity === "High" ? "critical" : e.severity === "Medium" ? "watch" : "info"}>{e.severity}</Sev>
                </td>
                <td><div style={{fontWeight: 500}}>{e.reason}</div></td>
                <td className="num"><span style={{fontWeight: 600}}>{e.count}</span></td>
                <td className="text-sm">{e.owner}</td>
                <td className="num text-mono">{e.oldest_d}d</td>
                <td className="text-mono text-xs muted">{e.related}</td>
                <td><button className="btn btn-sm">{e.action}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.AssetHealth = AssetHealth;
window.Notifications = Notifications;
window.Orders = Orders;
window.Exceptions = Exceptions;
