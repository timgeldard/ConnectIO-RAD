/* TR Creation Workbench
   Eligible process orders → choose Bulk Drop / Individual / Dispensary / Consolidated → log */

const TRC = (() => {
  const { orders } = window.DATA;

  const SourceChip = ({ s }) => (
    <span className={'chip ' + (s === 'S' ? 'chip-S' : 'chip-D')} title={s === 'S' ? 'Staging from Warehouse' : 'Staging from Dispensary'}>
      <span className="dot"/>{s}
    </span>
  );

  const PriorityDot = ({ p }) => {
    const map = { High: 'var(--sunset)', Medium: 'var(--sunrise)', Low: 'var(--ink-400)' };
    return (
      <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
        <span style={{width:8, height:8, borderRadius:999, background:map[p]}}/>
        <span style={{fontSize:11.5}}>{p}</span>
      </span>
    );
  };

  function ActionRail({ selected, onCreate }) {
    const sel = selected.size;
    const sCount = orders.filter(o => selected.has(o.po) && o.source === 'S').length;
    const dCount = sel - sCount;
    const disable = sel === 0;
    return (
      <div className="action-rail">
        <div className="group-label">Create from {sel} selected</div>
        <button className="ar-btn is-primary" disabled={disable} onClick={() => onCreate('bulk-drop')}>
          <Icon name="truck"/>
          <span className="text">
            <span className="label">Bulk Drop TOs</span>
            <span className="sub">{sCount} warehouse · 1 TR per pallet</span>
          </span>
          <kbd>B</kbd>
        </button>
        <button className="ar-btn" disabled={disable} onClick={() => onCreate('individual')}>
          <Icon name="box"/>
          <span className="text">
            <span className="label">Individual TRs</span>
            <span className="sub">One TR per process order</span>
          </span>
          <kbd>I</kbd>
        </button>
        <button className="ar-btn" disabled={dCount === 0} onClick={() => onCreate('dispensary')}>
          <Icon name="boxes"/>
          <span className="text">
            <span className="label">Dispensary TRs</span>
            <span className="sub">{dCount} dispensary · partials</span>
          </span>
          <kbd>D</kbd>
        </button>
        <button className="ar-btn" disabled={disable} onClick={() => onCreate('consolidated')}>
          <Icon name="merge"/>
          <span className="text">
            <span className="label">Consolidated TR</span>
            <span className="sub">Group same materials</span>
          </span>
          <kbd>C</kbd>
        </button>
        <div style={{height:1, background:'var(--stone-200)', margin:'6px 4px'}}/>
        <button className="ar-btn" disabled>
          <Icon name="out"/>
          <span className="text">
            <span className="label">Delivery Creation</span>
            <span className="sub">Not in use yet</span>
          </span>
        </button>
      </div>
    );
  }

  function TRCreation() {
    const [selected, setSelected] = React.useState(new Set(['70044182','70044188','70044191','70044194']));
    const [filter, setFilter] = React.useState('All');
    const [drawerPO, setDrawerPO] = React.useState(null);
    const [log, setLog] = React.useState([
      { ts: '08:09:51', type: 'success', text: 'Created 4 TRs (Bulk Drop) for POs 70044182, 70044188, 70044191, 70044194', meta: 'TR 0010024187, 188, 189, 194' },
      { ts: '08:09:51', type: 'error',   text: 'PO 70044187 — TR not created. Stock shortage on 6210-Y-EXT-10 (need 60 KG, available 42)', meta: 'Yeast Extract Powder' },
      { ts: '08:01:30', type: 'success', text: 'Created 2 TRs (Dispensary) for POs 70044184, 70044187', meta: 'TR 0010024188, 190' },
    ]);

    const filtered = orders.filter(o => {
      if (filter === 'Warehouse') return o.source === 'S';
      if (filter === 'Dispensary') return o.source === 'D';
      if (filter === 'Aged') return o.status === 'aged';
      return true;
    });

    const toggle = (po) => {
      const s = new Set(selected);
      if (s.has(po)) s.delete(po); else s.add(po);
      setSelected(s);
    };
    const allSelected = filtered.every(o => selected.has(o.po));
    const someSelected = filtered.some(o => selected.has(o.po));
    const toggleAll = () => {
      if (allSelected) setSelected(new Set());
      else setSelected(new Set(filtered.map(o => o.po)));
    };

    const onCreate = (kind) => {
      const ts = new Date().toLocaleTimeString([], {hour12:false}).slice(0,8);
      const sel = [...selected];
      const okPOs = sel.filter(po => orders.find(o => o.po === po).status !== 'short');
      const badPOs = sel.filter(po => orders.find(o => o.po === po).status === 'short');
      const next = [];
      next.push({ ts, type: 'success', text: `Created ${okPOs.length} TR${okPOs.length===1?'':'s'} (${kind}) for POs ${okPOs.join(', ')}`, meta: 'queued for assignment' });
      badPOs.forEach(po => {
        next.push({ ts, type: 'error', text: `PO ${po} — TR not created. Stock shortage detected during simulation.`, meta: 'see Why panel' });
      });
      setLog([...next, ...log]);
      setSelected(new Set());
    };

    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Job Creation</div>
            <h1 className="h-impact">TR Creation Workbench</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span><b>{orders.length}</b> eligible POs</span>
            <span><b>{orders.filter(o=>o.source==='S').length}</b> warehouse</span>
            <span><b>{orders.filter(o=>o.source==='D').length}</b> dispensary</span>
            <span><b>{orders.filter(o=>o.status==='aged').length}</b> aged &gt; 4h</span>
          </div>
        </div>

        <div className="split split-3070">
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div className="toolbar">
              <span className="selcount">{selected.size} selected</span>
              <div className="tabs" style={{padding:0, border:0}}>
                {['All','Warehouse','Dispensary','Aged'].map(t => (
                  <button key={t} className={'tab' + (filter===t?' active':'')} onClick={() => setFilter(t)}>
                    {t}
                    <span className="count">{
                      t==='All' ? orders.length :
                      t==='Warehouse' ? orders.filter(o=>o.source==='S').length :
                      t==='Dispensary' ? orders.filter(o=>o.source==='D').length :
                      orders.filter(o=>o.status==='aged').length
                    }</span>
                  </button>
                ))}
              </div>
              <div className="grow"/>
              <button className="btn btn-secondary btn-sm"><Icon name="filter"/>Filters</button>
              <button className="btn btn-secondary btn-sm"><Icon name="column"/>Columns</button>
              <button className="btn btn-secondary btn-sm"><Icon name="save"/>Save view</button>
            </div>
            <div style={{maxHeight:'calc(100vh - 380px)', overflow:'auto'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{width:32}}>
                      <input type="checkbox" className={'cb' + (someSelected && !allSelected ? ' partial':'')} checked={allSelected} onChange={toggleAll}/>
                    </th>
                    <th>Source</th>
                    <th>Process Order</th>
                    <th>Material · Description</th>
                    <th>PSA</th>
                    <th>Process Line</th>
                    <th>Bin</th>
                    <th className="num">Lines WM</th>
                    <th className="num">Lines Disp.</th>
                    <th className="num">Pallets</th>
                    <th className="num">Weight</th>
                    <th>Priority</th>
                    <th>Required</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const isSel = selected.has(o.po);
                    return (
                      <tr key={o.po} className={(isSel?'selected ':'') + (o.status==='aged'?'is-aged':'')} onClick={() => setDrawerPO(o)}>
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="cb" checked={isSel} onChange={() => toggle(o.po)}/>
                        </td>
                        <td><SourceChip s={o.source}/></td>
                        <td className="mono strong">{o.po}</td>
                        <td>
                          <div style={{display:'flex',flexDirection:'column',lineHeight:1.2}}>
                            <span className="strong">{o.desc}</span>
                            <span className="mono" style={{fontSize:10.5, color:'var(--ink-500)'}}>{o.material}</span>
                          </div>
                        </td>
                        <td className="mono">{o.psa}</td>
                        <td>{o.line}</td>
                        <td className="mono">{o.whse}</td>
                        <td className="num">{o.linesWM || '—'}</td>
                        <td className="num">{o.linesDsp || '—'}</td>
                        <td className="num">{o.pallets}</td>
                        <td className="num">{o.weight} kg</td>
                        <td><PriorityDot p={o.priority}/></td>
                        <td className="mono">{o.reqDate.slice(5)}</td>
                        <td>
                          {o.status === 'aged' ? <span className="chip chip-warn"><Icon name="clock" size={10}/>{o.ageHours}h</span> :
                           o.status === 'short' ? <span className="chip chip-danger"><Icon name="warn" size={10}/>Short</span> :
                           null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <ActionRail selected={selected} onCreate={onCreate}/>
            <div className="why">
              <div className="why-title"><Icon name="info" size={11}/>Why this preview</div>
              <ul>
                <li>Action will simulate stock at item bin level before creating any TR.</li>
                <li>Selected: {selected.size} POs ({orders.filter(o => selected.has(o.po) && o.source==='S').length} warehouse, {orders.filter(o => selected.has(o.po) && o.source==='D').length} dispensary).</li>
                <li>Aged POs (over 4h since release) will be prioritised in the TR queue.</li>
                <li>If any item fails simulation, the entire PO is skipped and reported in the log — no partial TR.</li>
              </ul>
            </div>
            <div className="log-panel">
              <div className="log-head">
                <Icon name="clipboard" size={11}/>
                <span>Creation Log</span>
                <span className="grow"/>
                <span>Session</span>
              </div>
              {log.slice(0, 6).map((r, i) => (
                <div key={i} className={'log-row ' + r.type}>
                  <span className="ts">{r.ts}</span>
                  <span className="icon">
                    <Icon name={r.type==='success' ? 'check' : r.type==='error' ? 'x' : 'info'} size={13}/>
                  </span>
                  <span style={{minWidth:0}}>
                    <div style={{fontWeight:500, lineHeight:1.3}}>{r.text}</div>
                    <div className="meta">{r.meta}</div>
                  </span>
                  <a href="#" onClick={e=>e.preventDefault()} style={{fontSize:10.5, color:'var(--valentia-slate)', fontWeight:600}}>Trace</a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {drawerPO && <PODrawer po={drawerPO} onClose={() => setDrawerPO(null)}/>}
      </div>
    );
  }

  function PODrawer({ po, onClose }) {
    return (
      <>
        <div className="drawer-scrim" onClick={onClose}/>
        <aside className="drawer">
          <div className="drawer-head">
            <div style={{display:'flex',flexDirection:'column'}}>
              <span className="eyebrow">Process Order</span>
              <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:18, color:'var(--forest)'}}>{po.po}</span>
            </div>
            <span className="grow"/>
            <button className="close" onClick={onClose}><Icon name="x"/></button>
          </div>
          <div className="drawer-body">
            <div style={{marginBottom:18}}>
              <div className="eyebrow" style={{marginBottom:6}}>Material</div>
              <div style={{fontWeight:600, fontSize:14}}>{po.desc}</div>
              <div className="mono" style={{fontSize:11, color:'var(--ink-500)'}}>{po.material}</div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18}}>
              <KV label="Source" val={<TRC.SourceChip s={po.source}/>}/>
              <KV label="Priority" val={<PriorityDot p={po.priority}/>}/>
              <KV label="PSA" val={<span className="mono">{po.psa}</span>}/>
              <KV label="Process Line" val={po.line}/>
              <KV label="Source Bin" val={<span className="mono">{po.whse}</span>}/>
              <KV label="Required" val={<span className="mono">{po.reqDate}</span>}/>
              <KV label="Pallets" val={po.pallets}/>
              <KV label="Weight" val={<span className="mono">{po.weight} kg</span>}/>
            </div>

            <div className="why" style={{marginBottom:14}}>
              <div className="why-title"><Icon name="sparkles" size={11}/>Stock simulation</div>
              {po.status === 'short' ? (
                <ul>
                  <li><b>Shortage:</b> 42 KG available / 60 KG required.</li>
                  <li>Suggested action: split TR or release backup batch from D-04-08.</li>
                </ul>
              ) : (
                <ul>
                  <li>{po.weight} kg available across {po.pallets} pallet{po.pallets===1?'':'s'}.</li>
                  <li>Picking strategy: {po.source === 'S' ? 'Bulk Drop, partial pallets first' : 'Dispensary, FIFO'}.</li>
                  <li>Estimated TO creation: 1 header + {Math.max(po.linesWM, po.linesDsp)} item lines.</li>
                </ul>
              )}
            </div>

            <h3 className="h-section" style={{marginBottom:8}}>Item Overview</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Bin</th>
                  <th className="num">Qty</th>
                  <th>Batch</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({length: Math.max(2, po.linesWM || po.linesDsp)}).slice(0,5).map((_, i) => (
                  <tr key={i}>
                    <td className="mono">{String(i+1).padStart(3,'0')}0</td>
                    <td className="mono">{po.whse}-{i+1}</td>
                    <td className="num">{Math.round(po.weight / Math.max(1, po.pallets))} kg</td>
                    <td className="mono">{`B-26${(i*7)%99}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="drawer-foot">
            <button className="btn btn-secondary"><Icon name="eye"/>View full</button>
            <button className="btn btn-primary"><Icon name="plus"/>Create TR</button>
          </div>
        </aside>
      </>
    );
  }

  function KV({ label, val }) {
    return (
      <div>
        <div className="eyebrow" style={{marginBottom:4}}>{label}</div>
        <div style={{fontSize:13, fontWeight:500}}>{val}</div>
      </div>
    );
  }

  return { TRCreation, SourceChip, PriorityDot };
})();

window.TRCreation = TRC.TRCreation;
