// ============================================================================
// Module: Backlog & Planning Workbench
// ============================================================================
const BacklogWorkbench = ({ onOpen }) => {
  const D = window.PMData;
  const [tab, setTab] = React.useState("schedule"); // matrix | list | schedule
  const [view, setView] = React.useState("hours");

  return (
    <div className="vstack" style={{gap: 16}}>
      <PageHeader
        eyebrow="Workbench"
        title="Backlog & Planning"
        sub="Triage actionable work, balance load across work centers, and commit a credible week."
        right={<>
          <button className="btn btn-sm"><Icon name="calendar" size={13}/>Week of May 4 – 10</button>
          <button className="btn btn-sm"><Icon name="star" size={13}/>Save view</button>
          <button className="btn btn-primary btn-sm"><Icon name="check" size={13}/>Commit week</button>
        </>}
      />

      {/* Top KPI row — backlog focused */}
      <div className="grid cols-5">
        <KPICard label="Backlog · orders" value={1247} unit="" trend="+8.2%" dir="up-bad" status="watch" spark={D.SPARKS.backlog_orders}/>
        <KPICard label="Backlog · hours" value="8,420" unit="h" trend="+312" dir="up-bad" status="watch" spark={D.SPARKS.backlog_hours}/>
        <KPICard label="Overdue PM" value={41} unit="" trend="+9" dir="up-bad" status="critical"/>
        <KPICard label="Schedulable next 7d" value="2,180" unit="h" trend="" dir="flat" status="ok"/>
        <KPICard label="Capacity next 7d" value="1,860" unit="h" trend="-320" dir="down" status="critical"
          hint="Demand exceeds capacity by 320 hours."/>
      </div>

      <AlertStrip tone="watch" icon="alert">
        <strong>Capacity gap of 320 hours</strong> next week against 2,180 hours of schedulable work. MECH-A and ELEC are the bottlenecks. Consider deferring P3/P4 preventive routes or borrowing from MECH-B.
      </AlertStrip>

      <div className="hstack between">
        <Tabs value={tab} onChange={setTab} tabs={[
          {value: "schedule", label: "Schedule board", count: 27},
          {value: "matrix", label: "Backlog matrix"},
          {value: "list", label: "Backlog list", count: 1247},
        ]}/>
        <div className="hstack gap-2">
          <ToggleGroup value={view} onChange={setView} options={[{value:"hours",label:"Hours"},{value:"count",label:"Count"}]}/>
        </div>
      </div>

      {tab === "schedule" && <ScheduleBoard onOpen={onOpen}/>}
      {tab === "matrix" && <BacklogMatrixView view={view}/>}
      {tab === "list" && <BacklogList onOpen={onOpen}/>}
    </div>
  );
};

const ScheduleBoard = ({ onOpen }) => {
  const D = window.PMData;
  return (
    <div className="grid cols-12">
      <div className="card span-8">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">7-day schedule · Beloit</span>
            <span className="section-title">Schedule board</span>
          </div>
          <div className="hstack gap-2 text-xs">
            <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, borderRadius: 2, background: "var(--critical)"}}/>P1</span>
            <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, borderRadius: 2, background: "var(--watch)"}}/>P2</span>
            <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, borderRadius: 2, background: "var(--valentia-slate)"}}/>P3+</span>
            <button className="btn btn-ghost btn-sm"><Icon name="grid" size={13}/>Density</button>
          </div>
        </div>
        <div className="card-pad" style={{padding: 14}}>
          <div className="sched">
            <div className="sched-cell head">Work center</div>
            {D.SCHED_DAYS.map(d => <div key={d} className="sched-cell head">{d}</div>)}
            {D.SCHED_CENTERS.map(wc => {
              const wcData = D.WORK_CENTERS.find(w => w.id === wc);
              return (
                <React.Fragment key={wc}>
                  <div className="sched-cell row-head">
                    <span>{wc}</span>
                    <span className="sub">{wcData.hours}h cap.</span>
                  </div>
                  {(D.SCHED_TASKS[wc] || []).map((tasks, di) => {
                    const used = tasks.reduce((s, t) => s + t.h, 0);
                    const overcap = used > wcData.hours / 7 + 2;
                    return (
                      <div key={di} className="sched-cell" style={overcap ? {boxShadow: "inset 0 0 0 1.5px var(--critical)"} : {}}>
                        {tasks.map((t, ti) => (
                          <div key={ti} className="sched-task" data-prio={t.prio}
                            onClick={() => onOpen({type: "order", id: t.wo})} draggable>
                            <div className="text-mono" style={{fontSize: 10, opacity: 0.75}}>{t.wo} · {t.h}h</div>
                            <div style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{t.desc}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
          <div className="hstack" style={{marginTop: 12, fontSize: 12, color: "var(--ink-3)"}}>
            <Icon name="alert" size={13} style={{color: "var(--critical)", marginRight: 6}}/>
            MECH-A on Mon–Tue exceeds daily capacity. Drag tasks to balance load.
          </div>
        </div>
      </div>

      <div className="card span-4">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">Unassigned</span>
            <span className="section-title">Ready to schedule</span>
          </div>
          <span className="text-mono muted text-xs">12 items · 84h</span>
        </div>
        <div className="card-pad">
          <div className="vstack" style={{gap: 8}}>
            {D.ORDERS.filter(o => o.status === "Released" || o.status === "Created").slice(0, 7).map(o => (
              <div key={o.id} draggable
                onClick={() => onOpen({type: "order", id: o.id})}
                style={{padding: 10, border: "1px solid var(--border-1)", borderRadius: 6, cursor: "grab", background: "var(--surface-panel)"}}>
                <div className="hstack" style={{gap: 6, marginBottom: 4}}>
                  <Prio p={o.prio}/>
                  <span className="text-mono text-xs muted">{o.id}</span>
                  <div style={{flex: 1}}/>
                  {o.overdue && <Sev tone="critical" dot={false}>Overdue</Sev>}
                </div>
                <div style={{fontSize: 13, fontWeight: 500, color: "var(--ink-strong)", marginBottom: 2}}>{o.desc}</div>
                <div className="hstack" style={{gap: 8, fontSize: 11, color: "var(--ink-3)"}}>
                  <span>{o.equip}</span>
                  <span>·</span>
                  <span className="text-mono">{o.planned_h}h</span>
                  <span>·</span>
                  <span>{o.wc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BacklogMatrixView = ({ view }) => {
  const D = window.PMData;
  return (
    <div className="grid cols-12">
      <div className="card span-7">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">Distribution</span>
            <span className="section-title">Backlog hours by age × priority</span>
          </div>
        </div>
        <div className="card-pad">
          <BacklogMatrix ages={D.BACKLOG_AGE.ages} priorities={D.BACKLOG_AGE.priorities} matrix={D.BACKLOG_AGE.matrix}/>
          <div style={{marginTop: 14, padding: 12, background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 6, fontSize: 12, color: "var(--ink)"}}>
            <strong>Insight:</strong> 60% of backlog hours sit in P3 medium priority aged 15–60 days. Consider a clearing wave on P3 with planner Marcus Holloway.
          </div>
        </div>
      </div>
      <div className="card span-5">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">By work center</span>
            <span className="section-title">Backlog hours · ownership</span>
          </div>
        </div>
        <div className="card-pad">
          <table className="tbl" style={{fontSize: 12}}>
            <thead>
              <tr><th>Work center</th><th style={{textAlign: "right"}}>Open</th><th style={{textAlign: "right"}}>Hours</th><th style={{textAlign: "right"}}>% O/D</th><th style={{textAlign: "right"}}>P1</th></tr>
            </thead>
            <tbody>
              {D.BACKLOG_BY_WC.map(wc => (
                <tr key={wc.id}>
                  <td>
                    <div style={{fontWeight: 500}}>{wc.id}</div>
                    <div className="text-xs muted">{wc.name}</div>
                  </td>
                  <td className="num">{wc.open}</td>
                  <td className="num">{wc.hours.toLocaleString()}</td>
                  <td className="num">
                    <Sev tone={wc.overdue_pct > 20 ? "critical" : wc.overdue_pct > 15 ? "watch" : "ok"} dot={false}>{wc.overdue_pct}%</Sev>
                  </td>
                  <td className="num">{wc.critical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BacklogList = ({ onOpen }) => {
  const D = window.PMData;
  return (
    <div className="card">
      <div className="card-header">
        <div className="hstack gap-2">
          <Chip active>All <span className="count">1247</span></Chip>
          <Chip>Overdue <span className="count">41</span></Chip>
          <Chip>This week <span className="count">87</span></Chip>
          <Chip>Unscheduled <span className="count">312</span></Chip>
          <Chip>Awaiting parts <span className="count">88</span></Chip>
        </div>
        <div className="hstack gap-2">
          <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13}/>Filter</button>
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={13}/>Export</button>
        </div>
      </div>
      <div style={{maxHeight: 600, overflowY: "auto"}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 40}}>Pri</th>
              <th style={{width: 110}}>Order</th>
              <th style={{width: 110}}>Type</th>
              <th>Description</th>
              <th style={{width: 160}}>Equipment</th>
              <th style={{width: 70}}>WC</th>
              <th style={{width: 110}}>Planner</th>
              <th style={{width: 100}}>Status</th>
              <th style={{width: 60, textAlign: "right"}}>Hrs</th>
              <th style={{width: 90}}>Due</th>
            </tr>
          </thead>
          <tbody>
            {D.ORDERS.map(o => (
              <tr key={o.id} onClick={() => onOpen({type: "order", id: o.id})}>
                <td><Prio p={o.prio}/></td>
                <td className="id">{o.id}</td>
                <td className="text-sm muted">{o.type}</td>
                <td>{o.desc}</td>
                <td className="text-sm" style={{color: "var(--ink-2)"}}>{o.equip}</td>
                <td className="text-mono text-xs">{o.wc}</td>
                <td>
                  <div className="hstack" style={{gap: 6}}>
                    <Avatar initials={o.planner.split(" ").map(n => n[0]).join("")} name={o.planner} sm/>
                    <span className="text-sm" style={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{o.planner.split(" ")[1]}</span>
                  </div>
                </td>
                <td><Sev tone={o.status === "In progress" ? "info" : o.status === "Created" ? "neutral" : o.status === "Tech.Comp" ? "ok" : "neutral"} dot={false}>{o.status}</Sev></td>
                <td className="num">{o.planned_h}</td>
                <td className="num">{o.overdue ? <Sev tone="critical" dot={false}>Overdue</Sev> : <span className="muted text-mono">{o.due.slice(5)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.BacklogWorkbench = BacklogWorkbench;
