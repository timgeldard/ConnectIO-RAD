// ============================================================================
// Module: Reliability & Downtime Analytics
// ============================================================================
const Reliability = ({ onOpen, onNav }) => {
  const D = window.PMData;
  return (
    <div className="vstack" style={{gap: 16}}>
      <PageHeader
        eyebrow="Analytics"
        title="Reliability & Downtime"
        sub="Identify chronic underperformers, dominant failure modes, and where the next failure is most likely."
        right={<>
          <Select icon="calendar" value="90d" placeholder="Range"
            options={[{value:"30d",label:"Last 30 days"},{value:"90d",label:"Last 90 days"},{value:"12m",label:"Last 12 months"}]}/>
          <button className="btn btn-sm"><Icon name="beaker" size={13}/>Open RCA queue</button>
        </>}
      />

      <div className="grid cols-4">
        <KPICard label="MTTR · 30d" value={4.8} unit="hrs" trend="-0.6h" dir="down-good" status="ok" spark={D.SPARKS.mttr}/>
        <KPICard label="MTBF · 30d" value={142} unit="hrs" trend="+12h" dir="up" status="ok" spark={D.SPARKS.mtbf}/>
        <KPICard label="Availability · 30d" value={96.2} unit="%" trend="-0.4pp" dir="down" target={97.5} status="watch" spark={D.SPARKS.availability}/>
        <KPICard label="Downtime · last 72h" value={14.6} unit="hrs" trend="+3.1h" dir="up-bad" status="watch" spark={D.SPARKS.downtime_72h}/>
      </div>

      <div className="grid cols-12">
        {/* Heatmap */}
        <div className="card span-8">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Process line A · 14 days × 24 hrs</span>
              <span className="section-title">Availability heatmap</span>
            </div>
            <div className="hstack gap-2 text-xs">
              <span className="hstack" style={{gap: 4}}><span style={{width: 12, height: 8, background: "var(--ok-bg)", border: "1px solid var(--ok-border)"}}/>≥95%</span>
              <span className="hstack" style={{gap: 4}}><span style={{width: 12, height: 8, background: "var(--watch-bg)", border: "1px solid var(--watch-border)"}}/>50–94</span>
              <span className="hstack" style={{gap: 4}}><span style={{width: 12, height: 8, background: "var(--critical-bg)", border: "1px solid var(--critical-border)"}}/>&lt;50</span>
            </div>
          </div>
          <div className="card-pad">
            <HeatGrid
              rows={14} cols={24}
              matrix={D.AVAIL_HEAT}
              rowLabels={Array.from({length: 14}, (_, i) => `Apr ${19 + i > 30 ? (19 + i - 30) + " May" : 19 + i}`)}
              colLabels={["00","","","","04","","","","08","","","","12","","","","16","","","","20","","",""]}
            />
            <div style={{marginTop: 14, fontSize: 12, color: "var(--ink-3)"}}>
              <strong style={{color: "var(--critical)"}}>Two major outages</strong> visible: Apr 21 morning (4h dryer trip) and Apr 27 afternoon (2h evap). The Apr 30 overnight event is the current breakdown.
            </div>
          </div>
        </div>

        {/* Failure Pareto */}
        <div className="card span-4">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Pareto · 90 days</span>
              <span className="section-title">Failure modes</span>
            </div>
          </div>
          <div className="card-pad">
            <HBar
              data={D.FAILURE_MODES.map((f, i) => ({
                ...f, label: f.label,
                color: i < 3 ? "var(--critical)" : i < 5 ? "var(--watch)" : "var(--chart-2)"
              }))}
              valueKey="count" labelKey="label" colorKey="color" unit="" showShare/>
            <div style={{marginTop: 12, fontSize: 12, color: "var(--ink-3)"}}>
              <strong style={{color: "var(--ink)"}}>Bearings + seals = 41%</strong> of failures. Reliability team is running an RCA on bearing recurrences.
            </div>
          </div>
        </div>
      </div>

      {/* Bad actors leaderboard */}
      <div className="card">
        <div className="card-header">
          <div className="vstack" style={{gap: 2}}>
            <span className="section-eyebrow">Leaderboard · last 30 days</span>
            <span className="section-title">Bad actors</span>
          </div>
          <div className="hstack gap-2">
            <ToggleGroup value="failures" onChange={() => {}} options={[{value:"failures",label:"Failures"},{value:"downtime",label:"Downtime"},{value:"cost",label:"Cost"}]}/>
            <button className="btn btn-ghost btn-sm"><Icon name="download" size={13}/>Export</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 40}}>#</th>
              <th>Equipment</th>
              <th style={{width: 160}}>Functional location</th>
              <th style={{width: 80, textAlign: "right"}}>Failures</th>
              <th style={{width: 100, textAlign: "right"}}>Downtime</th>
              <th style={{width: 80, textAlign: "right"}}>MTBF</th>
              <th style={{width: 100, textAlign: "right"}}>Cost (USD)</th>
              <th style={{width: 80}}>Trend</th>
              <th style={{width: 130}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {D.BAD_ACTORS.map((a, i) => (
              <tr key={a.id} onClick={() => onNav("assets")}>
                <td className="text-mono muted">{i + 1}</td>
                <td><div style={{fontWeight: 500}}>{a.name}</div></td>
                <td className="id">{a.floc}</td>
                <td className="num"><span style={{color: "var(--critical)", fontWeight: 600}}>{a.failures}</span></td>
                <td className="num">{a.downtime} h</td>
                <td className="num">{a.mtbf} h</td>
                <td className="num">${(a.cost / 1000).toFixed(1)}k</td>
                <td>
                  <span className="kpi-trend" data-dir={a.trend}>
                    {a.trend === "up-bad" ? "▲" : a.trend === "down-good" ? "▼" : "—"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost"><Icon name="beaker" size={12}/>RCA</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Repeat failures + insufficient data */}
      <div className="grid cols-12">
        <div className="card span-7">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Pattern detection</span>
              <span className="section-title">Repeat failures within 30 days</span>
            </div>
            <span className="text-mono muted text-xs">6 patterns</span>
          </div>
          <div className="card-pad vstack" style={{gap: 10}}>
            {[
              { eq: "Spray Dryer #2", floc: "BLT.PRO.DRY.02", count: 3, mode: "Bearing failure", days: [2, 9, 24], rec: "Bearing kit replacement window scheduled for 5/8 night shift." },
              { eq: "Aseptic Filler 4", floc: "BLT.PKG.FIL.04", count: 2, mode: "Fill weight drift", days: [4, 11], rec: "Recommend valve seat replacement; 6h job." },
              { eq: "Capper #2", floc: "BLT.PKG.CAP.02", count: 2, mode: "Sensor fault", days: [5, 13], rec: "Replace torque sensor; covered under warranty." },
            ].map((r, i) => (
              <div key={i} style={{padding: 12, border: "1px solid var(--border-1)", borderRadius: 6, background: "var(--surface-panel)"}}>
                <div className="hstack between" style={{marginBottom: 6}}>
                  <div className="hstack gap-2">
                    <div style={{fontWeight: 600, color: "var(--ink-strong)"}}>{r.eq}</div>
                    <span className="text-mono text-xs muted">{r.floc}</span>
                  </div>
                  <Sev tone="critical" dot={false}>{r.count} occurrences · 30d</Sev>
                </div>
                <div className="text-sm" style={{color: "var(--ink-2)", marginBottom: 8}}>
                  <strong>Mode:</strong> {r.mode} · failed on days {r.days.map(d => `D-${d}`).join(", ")}
                </div>
                <div className="hstack between">
                  <div className="text-sm" style={{color: "var(--ink-2)"}}><Icon name="zap" size={12} style={{color: "var(--sunrise)"}}/> {r.rec}</div>
                  <button className="btn btn-sm">Open RCA</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card span-5">
          <div className="card-header">
            <div className="vstack" style={{gap: 2}}>
              <span className="section-eyebrow">Reliability quality</span>
              <span className="section-title">Coverage & data gaps</span>
            </div>
          </div>
          <div className="card-pad vstack" style={{gap: 14}}>
            <div className="vstack" style={{gap: 6}}>
              <div className="hstack between text-sm">
                <span>Equipment with sufficient data</span>
                <span className="text-mono" style={{fontWeight: 600}}>312 / 414</span>
              </div>
              <div className="bar"><span style={{width: "75%", background: "var(--ok)"}}/></div>
            </div>
            <div className="vstack" style={{gap: 6}}>
              <div className="hstack between text-sm">
                <span>Failure modes coded on breakdowns</span>
                <span className="text-mono" style={{fontWeight: 600}}>82%</span>
              </div>
              <div className="bar"><span style={{width: "82%", background: "var(--ok)"}}/></div>
            </div>
            <div className="vstack" style={{gap: 6}}>
              <div className="hstack between text-sm">
                <span>Downtime confirmations within 24h</span>
                <span className="text-mono" style={{fontWeight: 600}}>67%</span>
              </div>
              <div className="bar"><span style={{width: "67%", background: "var(--watch)"}}/></div>
            </div>
            <div style={{marginTop: 4, padding: 10, background: "var(--watch-bg)", border: "1px solid var(--watch-border)", borderRadius: 6, fontSize: 12, color: "var(--ink)"}}>
              <strong>102 assets</strong> have insufficient run-time data for MTBF calculation. Reliability metrics for these are hidden by default.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Reliability = Reliability;
