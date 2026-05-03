/* Detail drawer (right-side) — variants for batch/STO/process/order. */

const DrawerHeader = ({ eyebrow, title, sub, badge, onClose }) => (
  <div className="drawer__hd">
    <div style={{ flex: 1 }}>
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <div className="sub">{sub}</div>
      {badge && <div className="mt-8">{badge}</div>}
    </div>
    <button className="iconbtn" onClick={onClose}><Icon name="x" size={16}/></button>
  </div>
);

const KV = ({ rows }) => (
  <div className="kv-grid">
    {rows.map(([k, v], i) => (
      <React.Fragment key={i}>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
      </React.Fragment>
    ))}
  </div>
);

const ChainView = ({ chain }) => (
  <div className="chain">
    {chain.map((n, i) => {
      const klass = n.status === 'risk' ? 'risk' : n.status === 'warn' ? 'warn' : n.status === 'pending' ? 'pending' : 'ok';
      const stage = TPM.stages.find(s => s.id === n.stage);
      return (
        <div key={i} className={'chain-node ' + klass}>
          <div className="chain-node__icon">
            {n.status === 'risk' ? <Icon name="alert" size={13}/> :
             n.status === 'warn' ? <Icon name="clock" size={13}/> :
             n.status === 'pending' ? <Icon name="clock" size={13}/> : <Icon name="check" size={13}/>}
          </div>
          <div className="chain-node__body">
            <div className="ttl">{n.ttl}</div>
            <div className="meta">{n.id} · <Plant code={n.plant.split(' ')[0]} /> {n.meta && '· ' + n.meta}</div>
          </div>
          <div className="chain-node__qty">
            {n.qty != null ? <>{TPM.fmtN(n.qty)} <span className="muted">kg</span></> : <span className="muted">—</span>}
            <span className="lbl">{stage ? stage.short : ''}</span>
          </div>
        </div>
      );
    })}
  </div>
);

const Drawer = ({ data, onClose }) => {
  if (!data) return null;
  const { type, payload } = data;

  let body = null, header = null;

  if (type === 'batch' || type === 'trace') {
    const lot = payload || TPM.traceLot;
    header = <DrawerHeader
      eyebrow="Batch / Lot"
      title={lot.lot}
      sub={lot.material + ' · ' + lot.desc}
      badge={<Badge kind="risk">Reconciliation mismatch · −12,450 kg at return</Badge>}
      onClose={onClose}
    />;
    body = (
      <>
        <div className="section-h">Quantity reconciliation</div>
        <div className="recon" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
          <div className="recon-cell is-balanced">
            <span className="lbl">Source GI</span>
            <span className="val">13,200</span>
            <span className="delta">kg · K140</span>
          </div>
          <div className="recon-cell is-balanced">
            <span className="lbl">TPM GR</span>
            <span className="val">13,200</span>
            <span className="delta">kg · T803</span>
          </div>
          <div className="recon-cell">
            <span className="lbl">Process out</span>
            <span className="val">12,450</span>
            <span className="delta">yield 94.3%</span>
          </div>
          <div className="recon-cell is-mismatch">
            <span className="lbl">Return GR</span>
            <span className="val">0</span>
            <span className="delta">expected 12,450</span>
          </div>
        </div>

        <div className="section-h">Chain of custody</div>
        <ChainView chain={lot.chain} />

        <div className="section-h">Batch genealogy</div>
        <KV rows={[
          ['Parent batch', 'B-K140-77508-A019'],
          ['Type', 'Split → reaction'],
          ['Child batch', 'B-2510-D'],
          ['Linked SO', 'SO-7700981221'],
        ]}/>

        <div className="section-h">Linked exceptions</div>
        <div className="row gap-8" style={{flexWrap:'wrap'}}>
          <Badge kind="risk">EX-2604-001 Return overdue 6d</Badge>
          <Badge kind="risk">EX-2604-002 PepsiCo at risk</Badge>
        </div>
      </>
    );
  } else if (type === 'sto') {
    const r = payload;
    header = <DrawerHeader eyebrow="Stock Transfer Order" title={r.id}
              sub={r.desc + ' · ' + r.mat}
              badge={<PlantFlow src={r.src} tpm={r.tpm} />}
              onClose={onClose}/>;
    body = (
      <>
        <div className="section-h">Lifecycle</div>
        <div className="recon" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <div className="recon-cell is-balanced"><span className="lbl">Ordered</span><span className="val">{TPM.fmtN(r.ordered)}</span><span className="delta">kg</span></div>
          <div className={'recon-cell ' + (r.shipped >= r.ordered ? 'is-balanced' : '')}><span className="lbl">Shipped (PGI)</span><span className="val">{TPM.fmtN(r.shipped)}</span><span className="delta">{r.doc}</span></div>
          <div className={'recon-cell ' + (r.received >= r.ordered ? 'is-balanced' : (r.delayD > 3 ? 'is-mismatch' : ''))}><span className="lbl">Received (GR)</span><span className="val">{r.received ? TPM.fmtN(r.received) : '—'}</span><span className="delta">{r.received ? 'on time' : (r.delayD>0 ? `+${r.delayD}d late` : 'pending')}</span></div>
        </div>
        <div className="section-h">Document chain</div>
        <KV rows={[
          ['STO', r.id],
          ['Source plant', r.src + ' · ' + TPM.plants[r.src].name],
          ['TPM plant', r.tpm + ' · ' + TPM.plants[r.tpm].name],
          ['Outbound delivery', r.doc],
          ['ETA', r.eta],
          ['Age', r.age + ' days'],
          ['Status', r.status],
        ]}/>
        <div className="section-h">Linked batches</div>
        <KV rows={[
          ['Parent batch', 'B-' + r.src + '-' + r.mat.slice(-5) + '-A019'],
          ['Expected child batch at TPM', 'B-2604-•'],
        ]}/>
      </>
    );
  } else if (type === 'process') {
    const p = payload;
    header = <DrawerHeader eyebrow="Toll Process" title={p.id}
              sub={p.desc + ' · ' + p.step + ' @ ' + TPM.plants[p.plant].name}
              badge={p.status === 'risk' ? <Badge kind="risk">Yield variance · TAT exceeded</Badge> : null}
              onClose={onClose}/>;
    body = (
      <>
        <div className="section-h">Yield & turnaround</div>
        <div className="recon" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <div className="recon-cell is-balanced"><span className="lbl">Qty in</span><span className="val">{TPM.fmtN(p.qtyIn)}</span><span className="delta">kg</span></div>
          <div className={'recon-cell ' + (p.varPct < -3 ? 'is-mismatch' : '')}><span className="lbl">Qty out</span><span className="val">{p.qtyOut ? TPM.fmtN(p.qtyOut) : '—'}</span><span className="delta">yield {p.yieldPct ? p.yieldPct + '%' : '—'}</span></div>
          <div className={'recon-cell ' + (p.tat > p.expTat ? 'is-mismatch' : 'is-balanced')}><span className="lbl">TAT</span><span className="val">{p.tat}d</span><span className="delta">expected {p.expTat}d</span></div>
        </div>
        <div className="section-h">Process detail</div>
        <KV rows={[
          ['Material', p.mat],
          ['Step', p.step],
          ['Started', p.started || '—'],
          ['TPM plant', p.plant + ' · ' + TPM.plants[p.plant].name],
          ['Variance', p.varPct != null ? p.varPct + '%' : '—'],
        ]}/>
      </>
    );
  } else if (type === 'exception') {
    const e = payload;
    header = <DrawerHeader eyebrow={'Exception · ' + e.id} title={e.kind}
              sub={'Owner ' + e.owner + ' · age ' + e.age + 'd'}
              badge={<Sev level={e.sev} />}
              onClose={onClose}/>;
    body = (
      <>
        <div className="section-h">Context</div>
        <KV rows={[
          ['Plant', e.plant],
          ['Material', e.mat],
          ['Quantity / risk', e.qty],
          ['Linked', e.linked],
          ['Status', e.status],
        ]}/>
        <div className="section-h">Suggested actions</div>
        <div className="row gap-8" style={{flexWrap:'wrap'}}>
          <button className="btn btn-sm"><Icon name="user" size={12}/> Reassign</button>
          <button className="btn btn-sm"><Icon name="link" size={12}/> Link parent</button>
          <button className="btn btn-sm"><Icon name="flag" size={12}/> Escalate</button>
          <button className="btn btn-primary btn-sm"><Icon name="check" size={12}/> Resolve</button>
        </div>
      </>
    );
  } else if (type === 'fulfil') {
    const f = payload;
    header = <DrawerHeader eyebrow="Fulfilment" title={f.id}
              sub={f.cust + ' · ' + f.desc}
              badge={f.status === 'risk' ? <Badge kind="risk">{f.risk}</Badge> : null}
              onClose={onClose}/>;
    body = (
      <>
        <div className="section-h">Order detail</div>
        <KV rows={[
          ['Customer / destination', f.cust],
          ['Source TPM', f.via + ' · ' + TPM.plants[f.via].name],
          ['Return plant', f.dst + ' · ' + TPM.plants[f.dst].name],
          ['Material', f.mat + ' · ' + f.desc],
          ['Quantity', TPM.fmtN(f.qty) + ' kg'],
          ['Due', f.due],
          ['Batch', f.batch],
        ]}/>
        <div className="section-h">After-return path</div>
        <PlantFlow src={f.via} tpm={f.dst} dst={f.kind === 'interplant' ? f.dst : null} />
      </>
    );
  }

  return (
    <>
      <div className={'drawer-scrim ' + (data ? 'is-open' : '')} onClick={onClose} />
      <div className={'drawer ' + (data ? 'is-open' : '')}>
        {header}
        <div className="drawer__bd">{body}</div>
        <div className="drawer__ft">
          <button className="btn btn-ghost btn-sm"><Icon name="link" size={12}/> Open full record</button>
          <button className="btn btn-ghost btn-sm"><Icon name="share" size={12}/> Share</button>
          <button className="btn btn-primary btn-sm"><Icon name="flag" size={12}/> Flag exception</button>
        </div>
      </div>
    </>
  );
};

window.Drawer = Drawer;
