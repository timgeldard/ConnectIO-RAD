// ============================================================================
// Module: Control Tower (Maintenance Overview)
// ============================================================================
const ControlTower = ({ persona, onOpen, onNav }) => {
  const D = window.PMData;
  const k = D.KPI_SUMMARY;

  return (
    <div className="vstack" style={{gap: 20}}>
      <PageHeader
        eyebrow="Cockpit · Beloit, WI"
        title="Maintenance Control Tower"
        sub="Live operational view across notifications, orders, backlog, and reliability."
        right={<>
          <Chip icon="pin">Pin to home</Chip>
          <button className="btn btn-sm"><Icon name="sliders" size={13}/>Configure KPIs</button>
          <button className="btn btn-primary btn-sm"><Icon name="zap" size={13}/>Open triage</button>
        </>}
      />

      {/* Critical alerts strip */}
      <AlertStrip tone="critical" icon="flame"
        action={<button className="btn btn-sm" onClick={() => onNav("backlog")}>Open backlog →</button>}>
        <strong>6 active breakdowns</strong> · 41 PM tasks overdue · Spray Dryer #2 has been down for 8h 14m affecting <strong>Powder Line A</strong>.
      </AlertStrip>

      {/* KPI strip */}
      <div className="grid cols-4">
        <KPICard label="Open backlog · orders" value={k.backlog_orders.value} unit="orders"
          trend={k.backlog_orders.trend} dir={k.backlog_orders.dir}
          target={k.backlog_orders.target} status={k.backlog_orders.status}
          spark={D.SPARKS.backlog_orders}
          onClick={() => onNav("backlog")}
          hint="All released and in-progress orders, excluding TECO and CLSD."/>
        <KPICard label="Backlog hours" value={k.backlog_hours.value} unit="hrs"
          trend={k.backlog_hours.trend} dir={k.backlog_hours.dir}
          status={k.backlog_hours.status} spark={D.SPARKS.backlog_hours}
          onClick={() => onNav("backlog")}/>
        <KPICard label="PM compliance · 30d rolling" value={k.pm_compliance.value} unit="%"
          trend={k.pm_compliance.trend} dir={k.pm_compliance.dir}
          target={k.pm_compliance.target} status={k.pm_compliance.status}
          spark={D.SPARKS.pm_compliance}
          hint="Preventive orders TECO'd within ±3 days of plan date."/>
        <KPICard label="Schedule compliance" value={k.schedule_compliance.value} unit="%"
          trend={k.schedule_compliance.trend} dir={k.schedule_compliance.dir}
          target={k.schedule_compliance.target} status={k.schedule_compliance.status}
          spark={D.SPARKS.schedule_compliance}/>
      </div>

      <div className="grid cols-4">
        <KPICard label="MTTR" value={k.mttr.value} unit="hrs"
          trend={k.mttr.trend} dir={k.mttr.dir} status={k.mttr.status}
          spark={D.SPARKS.mttr}/>
        <KPICard label="MTBF" value={k.mtbf.value} unit="hrs"
          trend={k.mtbf.trend} dir={k.mtbf.dir} status={k.mtbf.status}
          spark={D.SPARKS.mtbf}/>
        <KPICard label="Asset availability · 30d" value={k.availability.value} unit="%"
          trend={k.availability.trend} dir={k.availability.dir}
          target={k.availability.target} status={k.availability.status}
          spark={D.SPARKS.availability}/>
        <KPICard label="Open critical work" value={k.critical_open.value} unit="items"
          trend={k.critical_open.trend} dir={k.critical_open.dir}
          status={k.critical_open.status} spark={D.SPARKS.critical_open}
          onClick={() => onNav("orders")}/>
      </div>

      {/* Row: Backlog matrix + Work mix */}
      <div className="grid cols-12">
        <div className="card span-7">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Backlog distribution</span>
              <span className="section-title">Hours by age × priority</span>
            </div>
            <div className="hstack gap-2">
              <ToggleGroup value="hours" onChange={() => {}}
                options={[{value:"hours",label:"Hours"},{value:"count",label:"Count"}]}/>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav("backlog")}>
                Open workbench<Icon name="chevR" size={12}/>
              </button>
            </div>
          </div>
          <div className="card-pad">
            <BacklogMatrix ages={D.BACKLOG_AGE.ages} priorities={D.BACKLOG_AGE.priorities} matrix={D.BACKLOG_AGE.matrix}/>
            <div className="hstack" style={{marginTop: 14, gap: 14, fontSize: 11, color: "var(--ink-3)"}}>
              <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, background: "var(--critical)", borderRadius: 2}}/>P1 Emergency</span>
              <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, background: "var(--watch)", borderRadius: 2}}/>P2 High</span>
              <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 10, background: "var(--valentia-slate)", borderRadius: 2}}/>P3 Medium</span>
              <div style={{flex: 1}}/>
              <span>Click any cell to drill into the planning workbench.</span>
            </div>
          </div>
        </div>

        <div className="card span-5">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Last 30 days</span>
              <span className="section-title">Work mix</span>
            </div>
          </div>
          <div className="card-pad hstack" style={{gap: 24, alignItems: "center"}}>
            <div style={{position: "relative", width: 140, height: 140, flexShrink: 0}}>
              <Donut data={D.WORK_MIX.by_type} size={140} thickness={20}/>
              <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", lineHeight: 1.2}}>
                <div>
                  <div style={{fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em"}}>TOTAL</div>
                  <div style={{fontSize: 22, fontWeight: 600, color: "var(--ink-strong)"}}>{D.WORK_MIX.by_type.reduce((s, d) => s + d.count, 0)}</div>
                  <div style={{fontSize: 11, color: "var(--ink-3)"}}>orders</div>
                </div>
              </div>
            </div>
            <div className="vstack" style={{flex: 1, gap: 8}}>
              {D.WORK_MIX.by_type.map((m, i) => (
                <div key={i} className="hstack" style={{gap: 8, fontSize: 12}}>
                  <span style={{width: 10, height: 10, background: m.color, borderRadius: 2, flexShrink: 0}}/>
                  <span style={{flex: 1, color: "var(--ink-2)"}}>{m.label}</span>
                  <span className="text-mono" style={{color: "var(--ink-strong)", fontWeight: 600}}>{m.count}</span>
                  <span className="text-mono muted" style={{width: 40, textAlign: "right"}}>{m.pct}%</span>
                </div>
              ))}
              <div style={{height: 1, background: "var(--border-1)", margin: "4px 0"}}/>
              <div className="vstack" style={{gap: 6}}>
                <div className="text-xs muted">Planned vs unplanned</div>
                <div className="bar bar-stack">
                  <span style={{width: D.WORK_MIX.planned_unplanned.planned + "%", background: "var(--chart-1)"}}/>
                  <span style={{width: D.WORK_MIX.planned_unplanned.unplanned + "%", background: "var(--watch)"}}/>
                </div>
                <div className="hstack" style={{fontSize: 11}}>
                  <span style={{flex: 1, color: "var(--ink-2)"}}>Planned <span className="text-mono">{D.WORK_MIX.planned_unplanned.planned}%</span></span>
                  <span style={{color: "var(--watch)"}}>Unplanned <span className="text-mono">{D.WORK_MIX.planned_unplanned.unplanned}%</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row: Trend + Bad actors */}
      <div className="grid cols-12">
        <div className="card span-7">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">12-week trend</span>
              <span className="section-title">Compliance & schedule adherence</span>
            </div>
            <div className="hstack gap-2 text-xs">
              <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 2, background: "var(--chart-1)"}}/>PM compliance</span>
              <span className="hstack" style={{gap: 4}}><span style={{width: 10, height: 2, background: "var(--chart-5)"}}/>Schedule compliance</span>
            </div>
          </div>
          <div className="card-pad">
            <LineChart
              w={620} h={200}
              series={[
                { name: "PM compliance", color: "var(--chart-1)", data: D.SPARKS.pm_compliance },
                { name: "Schedule compliance", color: "var(--chart-5)", data: D.SPARKS.schedule_compliance },
              ]}
              yMin={70} yMax={95}
              xLabels={["W-12","W-11","W-10","W-9","W-8","W-7","W-6","W-5","W-4","W-3","W-2","W-1"]}
              fmt={(v) => v.toFixed(0) + "%"}
              threshold={90}
            />
          </div>
        </div>

        <div className="card span-5">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Last 30 days</span>
              <span className="section-title">Top bad actors</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNav("reliability")}>
              All<Icon name="chevR" size={12}/>
            </button>
          </div>
          <div className="card-pad">
            <div className="vstack" style={{gap: 10}}>
              {D.BAD_ACTORS.slice(0, 5).map((a, i) => (
                <div key={a.id} className="hstack" style={{gap: 10, padding: "6px 0", borderBottom: i < 4 ? "1px solid var(--border-1)" : "none", cursor: "pointer"}}
                  onClick={() => onNav("assets")}>
                  <div className="text-mono muted" style={{width: 14, fontSize: 11}}>{i + 1}</div>
                  <div className="vstack" style={{gap: 2, flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 13, fontWeight: 500, color: "var(--ink-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{a.name}</div>
                    <div className="text-mono text-xs muted">{a.floc}</div>
                  </div>
                  <div className="vstack" style={{gap: 1, alignItems: "flex-end", flex: "0 0 70px"}}>
                    <div className="text-mono text-sm" style={{color: "var(--critical)", fontWeight: 600}}>{a.failures} failures</div>
                    <div className="text-mono text-xs muted">{a.downtime}h dt</div>
                  </div>
                  <div style={{flex: "0 0 56px"}}>
                    <Sparkline data={[1,2,2,3,4,4,5,6,7,8,9,a.failures]} h={20} w={56}
                      color={a.trend === "down-good" ? "var(--ok)" : "var(--critical)"} stroke={1.2}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row: Critical work + Backlog by WC */}
      <div className="grid cols-12">
        <div className="card span-7">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Top of queue</span>
              <span className="section-title">Critical work — needs attention today</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNav("orders")}>
              Open queue<Icon name="chevR" size={12}/>
            </button>
          </div>
          <div className="tbl-wrap" style={{borderRadius: 0, border: "none"}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width: 38}}>Pri</th>
                  <th style={{width: 110}}>Order</th>
                  <th>Description</th>
                  <th style={{width: 130}}>Equipment</th>
                  <th style={{width: 90}}>Owner</th>
                  <th style={{width: 80}}>Due</th>
                </tr>
              </thead>
              <tbody>
                {D.ORDERS.filter(o => o.prio === "P1" || o.prio === "P2" || o.overdue).slice(0, 6).map(o => (
                  <tr key={o.id} onClick={() => onOpen({type: "order", id: o.id})}>
                    <td><Prio p={o.prio}/></td>
                    <td className="id">{o.id}</td>
                    <td>{o.desc}</td>
                    <td className="text-sm" style={{color: "var(--ink-2)"}}>{o.equip}</td>
                    <td><Avatar initials={o.planner.split(" ").map(n => n[0]).join("")} name={o.planner} sm/></td>
                    <td className="num">{o.overdue ? <Sev tone="critical" dot={false}>Overdue</Sev> : <span className="muted">{o.due.slice(5)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card span-5">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Ownership</span>
              <span className="section-title">Backlog by work center</span>
            </div>
          </div>
          <div className="card-pad">
            <HBar
              data={D.BACKLOG_BY_WC.map(wc => ({label: wc.id, value: wc.hours, color: "var(--chart-1)", share: wc.overdue_pct}))}
              valueKey="value" labelKey="label" colorKey="color"
              unit="h" showShare/>
            <div className="hstack" style={{marginTop: 12, fontSize: 11, color: "var(--ink-3)", gap: 12}}>
              <span>Backlog hours</span>
              <div style={{flex: 1}}/>
              <span>% overdue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ControlTower = ControlTower;
