/* Module 8 — Exceptions */
const ModuleExcept = ({ openDrawer }) => {
  const T = window.TPM;
  const [sev, setSev] = React.useState('all');
  const list = T.exceptions.filter(e => sev==='all' ? true : e.sev === sev);

  const counts = {
    p1: T.exceptions.filter(e=>e.sev==='p1').length,
    p2: T.exceptions.filter(e=>e.sev==='p2').length,
    p3: T.exceptions.filter(e=>e.sev==='p3').length,
  };

  const kinds = [...new Set(T.exceptions.map(e=>e.kind))].map(k=>({
    kind: k, count: T.exceptions.filter(e=>e.kind===k).length,
  }));

  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="Open exceptions" value={47} unit="" delta={+5} status="risk" spark={[30,32,35,38,40,42,44,46,47]} accent={true}/></div>
        <div className="col-3"><Kpi label="P1 critical" value={counts.p1} unit="" delta={+1} status="risk" spark={[1,1,2,2,2,2,2,2,2]}/></div>
        <div className="col-3"><Kpi label="Aged > 7d" value={9} unit="" delta={+2} status="pending" spark={[5,6,6,7,7,8,8,9,9]}/></div>
        <div className="col-3"><Kpi label="Resolved this week" value={31} unit="" delta={+8} status="ok" spark={[18,20,22,24,26,28,29,30,31]}/></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-7">
          <Card title="Exception queue" sub={list.length+' of '+T.exceptions.length} flush
                actions={<button className="btn btn-sm btn-primary"><Icon name="check" size={12}/> Bulk resolve</button>}>
            <div style={{padding:'8px 12px', borderBottom:'1px solid var(--line-soft)', display:'flex', gap:6}}>
              {['all','p1','p2','p3'].map(s=>(
                <button key={s} className={'chip '+(sev===s?'is-active':'')} onClick={()=>setSev(s)}>
                  <span className="val">{s==='all'?'All':s.toUpperCase()}</span>
                  <span className="label" style={{marginLeft:4}}>{s==='all'?T.exceptions.length:counts[s]}</span>
                </button>
              ))}
              <span style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> By owner</button>
            </div>
            <table className="tbl">
              <thead><tr>
                <th style={{width:50}}>Sev</th><th>Exception</th><th>Plant</th><th>Material</th>
                <th>Linked</th><th>Owner</th><th className="num">Age</th><th className="num">Impact</th><th></th>
              </tr></thead>
              <tbody>
                {list.map(e=>(
                  <tr key={e.id} className={e.sev==='p1'?'is-risk-row':e.sev==='p2'?'is-warn-row':''}
                      onClick={()=>openDrawer({type:'exception', payload: e})}>
                    <td><Sev level={e.sev}/></td>
                    <td><div style={{fontWeight:600}}>{e.kind}</div><div className="muted code" style={{fontSize:10}}>{e.id}</div></td>
                    <td><Plant code={e.plant}/></td>
                    <td className="code">{e.mat}</td>
                    <td className="muted code" style={{fontSize:11}}>{e.linked}</td>
                    <td>{e.owner}</td>
                    <td className="num"><span style={{color:e.age>7?'var(--status-risk)':e.age>3?'var(--status-pending)':'var(--ink)'}}>{e.age}d</span></td>
                    <td className="num">{e.qty}</td>
                    <td><Icon name="chevron-r" size={14} className="muted"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="col-5">
          <Card title="Exceptions by category" sub="Across last 30 days">
            <table className="tbl">
              <thead><tr><th>Category</th><th className="num">Open</th><th>Trend</th></tr></thead>
              <tbody>
                {kinds.map((k,i)=>(
                  <tr key={i}>
                    <td>{k.kind}</td>
                    <td className="num">{k.count}</td>
                    <td><Spark data={[i+1,i+2,i+1,i+2,i+3,i+2,i+3,i+3]} width={80} height={20} color={k.count>=2?'var(--status-risk)':'var(--ink-muted)'} area={false}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="mt-16" title="Recommended next actions" sub="Auto-grouped by signature">
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <Alert kind="risk" ttl="Escalate Saraburi (T803) returns" body="11 lots / 18.4t late · open vendor escalation L2" cta="Open"/>
              <Alert kind="pending" ttl="Coppini (T801) granulation review" body="Yield variance −4.6% on 7 lots · request RCA" cta="Open"/>
              <Alert kind="info" ttl="Confirm batch 0042-9921 link" body="Missing GR ↔ batch link at T802 · 1 click to relink" cta="Relink"/>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};
window.ModuleExcept = ModuleExcept;

/* Saved views & Settings — small placeholder modules */
const ModuleViews = () => {
  const T = window.TPM;
  return (
    <Card title="Saved views" sub="Personal and shared">
      <table className="tbl">
        <thead><tr><th>Name</th><th>Owner</th><th>Module</th><th>Last opened</th><th></th></tr></thead>
        <tbody>
          {T.savedViews.map((v,i)=>(
            <tr key={i}>
              <td><b>{v.name}</b></td>
              <td>{v.owner==='me'?'You':'Shared with team'}</td>
              <td>Control Tower</td>
              <td className="mono muted">2 hours ago</td>
              <td><button className="btn btn-sm">Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
const ModuleSettings = () => (
  <Card title="Settings" sub="TPM cockpit preferences">
    <div className="muted">User preferences, data freshness thresholds, exception rules, notification settings, and access controls live here.</div>
  </Card>
);
window.ModuleViews = ModuleViews;
window.ModuleSettings = ModuleSettings;
