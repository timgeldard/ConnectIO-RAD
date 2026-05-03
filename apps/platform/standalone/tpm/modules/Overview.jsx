/* Module 1 — Control Tower */
const ModuleOverview = ({ openDrawer }) => {
  const T = window.TPM;
  return (
    <>
      <div className="grid-12 mb-16">
        {T.overviewKpis.map(k => (
          <div key={k.id} className="col-3">
            <Kpi label={k.label} value={k.value} unit={k.unit} delta={k.trend} status={k.status} spark={k.spark}/>
          </div>
        ))}
      </div>

      <div className="grid-12 mb-16">
        {T.alerts.map((a, i) => (
          <div className="col-4" key={i}><Alert {...a} /></div>
        ))}
      </div>

      <Card title="End-to-end TPM lifecycle" sub="Source → TPM → Destination · volume in tonnes, count of lots, delay days at each stage"
            actions={<><button className="btn btn-ghost btn-sm"><Icon name="eye" size={12}/> Drill</button><button className="btn btn-ghost btn-sm"><Icon name="more" size={12}/></button></>}>
        <div className="flow">
          {T.lifecycleFunnel.map((f, i) => <FlowStep key={i} data={f} onClick={() => {}} />)}
        </div>
        <div className="row mt-12 gap-16" style={{fontSize: 11, color:'var(--ink-muted)'}}>
          <span><b style={{color:'var(--ink-strong)'}}>5,832 t</b> across all stages · <b style={{color:'var(--ink-strong)'}}>751 lots</b></span>
          <span className="row gap-4"><span className="dot" style={{width:8,height:8,borderRadius:'50%',background:'var(--status-ok)'}}/> Healthy</span>
          <span className="row gap-4"><span className="dot" style={{width:8,height:8,borderRadius:'50%',background:'var(--status-pending)'}}/> Aging / pending</span>
          <span className="row gap-4"><span className="dot" style={{width:8,height:8,borderRadius:'50%',background:'var(--status-risk)'}}/> Delayed / exception</span>
        </div>
      </Card>

      <div className="grid-12 mt-16">
        <div className="col-7">
          <Card title="Aging by stage" sub="Stock distribution by days held · 0–7 / 8–14 / 15–30 / 30+">
            {T.agingByStage.map((r, i) => <AgingRow key={i} label={r.stage} buckets={r.b} />)}
            <div className="aging-legend mt-12">
              <span className="sw"><i style={{background:'var(--status-ok)'}}/> 0–7d</span>
              <span className="sw"><i style={{background:'var(--sage)'}}/> 8–14d</span>
              <span className="sw"><i style={{background:'var(--status-pending)'}}/> 15–30d</span>
              <span className="sw"><i style={{background:'var(--status-risk)'}}/> 30+d</span>
            </div>
          </Card>
        </div>

        <div className="col-5">
          <Card title="Top TPM vendors" sub="By volume · with delay & exception counts"
                actions={<button className="btn btn-ghost btn-sm">All vendors <Icon name="chevron-r" size={12}/></button>}
                flush>
            <table className="tbl">
              <thead><tr>
                <th>Vendor</th><th className="num">Vol (t)</th><th className="num">Avg delay</th>
                <th className="num">Delayed</th><th className="num">Exc.</th><th></th>
              </tr></thead>
              <tbody>
                {T.topVendors.map((v, i) => (
                  <tr key={i}>
                    <td><div style={{display:'flex',flexDirection:'column'}}><span style={{fontWeight:600}}>{v.name}</span><span className="muted mono" style={{fontSize:10}}>{v.plant}</span></div></td>
                    <td className="num">{v.volume}</td>
                    <td className="num"><span style={{color: v.delay>10?'var(--status-risk)':v.delay>5?'var(--status-pending)':'var(--ink)'}}>{v.delay.toFixed(1)}d</span></td>
                    <td className="num">{v.delayed}</td>
                    <td className="num">{v.exceptions}</td>
                    <td style={{width:60}}>
                      <Spark data={v.trendDir==='up'?[2,3,4,4,5,6,7,8]:v.trendDir==='down'?[8,7,6,5,5,4,3,2]:[5,5,6,5,5,6,5,5]} width={50} height={20}
                             color={v.trendDir==='up'?'var(--status-risk)':v.trendDir==='down'?'var(--status-ok)':'var(--ink-muted)'} area={false}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="grid-12 mt-16">
        <div className="col-12">
          <Card title="Recent critical transactions" sub="Last 4h · highest severity first"
                actions={<button className="btn btn-ghost btn-sm">Open exceptions <Icon name="chevron-r" size={12}/></button>}
                flush>
            <table className="tbl">
              <thead><tr>
                <th style={{width:60}}>Sev</th><th style={{width:60}}>Time</th><th>Event</th>
                <th>Document</th><th>Material</th><th>Plant / route</th><th className="num">Qty / impact</th><th></th>
              </tr></thead>
              <tbody>
                {T.recentTx.map((t, i) => (
                  <tr key={i} className={t.sev==='p1'?'is-risk-row':t.sev==='p2'?'is-warn-row':''}
                      onClick={() => openDrawer({type:'trace'})}>
                    <td><Sev level={t.sev}/></td>
                    <td className="code muted">{t.ts}</td>
                    <td><span style={{fontWeight:600}}>{t.type}</span></td>
                    <td className="code">{t.doc}</td>
                    <td className="code">{t.mat}</td>
                    <td>{t.plant.includes('→') ? <PlantFlow src={t.plant.split('→')[0]} tpm={t.plant.split('→')[1]}/> : <Plant code={t.plant}/>}</td>
                    <td className="num">{t.qty}</td>
                    <td><Icon name="chevron-r" size={14} className="muted"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
};

window.ModuleOverview = ModuleOverview;
