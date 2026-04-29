// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useT } from '../i18n/context'
import { I as DI, TopBar, StatusBadge } from '../ui'
import { fetchOrderDetail } from '../api/orders'

// ----- helpers -----
function fmtSeconds(s) {
  if (!s && s !== 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtKg(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function OrderDetail({ order, onBack, from = 'list' }) {
  const { t } = useT();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insView, setInsView] = useState('table');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrderDetail(order.id)
      .then(d => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message || 'Failed to load order.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [order.id]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const msg = e?.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === '__activate_edit_mode') setTweaksOpen(true);
      if (msg.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const orderId = order.id;

  return (
    <>
      <TopBar
        trail={from === 'planning'
          ? [t.operations, t.crumbManufacturing || 'Manufacturing', t.navPlanning, orderId]
          : [t.operations, t.crumbManufacturing, t.crumbOrders, orderId]}
        onTrailClick={(i) => { if (i === 2) onBack(); }}
      />

      <div className="detail-head">
        <a className="back-link" onClick={onBack}>{DI.arrowL}<span>{t.backAll}</span></a>

        <div className="detail-id-row">
          <div className="id-block">
            <div className="detail-eyebrow">{DI.hexagon}<span>{t.detailEyebrow}</span></div>
            <h1 className="detail-title">
              <span style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:500,color:'var(--valentia-slate)',letterSpacing:'.01em'}}>{orderId}</span>
              <StatusBadge status={loading ? 'released' : (detail?.order?.status ?? order.status)} interactive={false} />
            </h1>
            <div className="detail-product">
              {loading ? <span style={{color:'var(--ink-400)'}}>Loading…</span>
                : detail ? detail.order.materialName
                : <span style={{color:'var(--red-600)'}}>—</span>}
              {detail && (
                <span className="sku">
                  {t.sumMaterial} <span style={{fontFamily:'var(--font-mono)'}}>{detail.order.materialId}</span>
                  {detail.order.materialCategory ? ` · ${detail.order.materialCategory}` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn secondary">{DI.printer}<span>{t.actionPrintMBR}</span></button>
            <button className="btn primary">{DI.download}<span>{t.actionExportBundle}</span></button>
          </div>
        </div>

        {detail && <SummaryStrip detail={detail} t={t} />}
        {detail && <SubMetaStrip detail={detail} t={t} />}
      </div>

      {loading && (
        <div style={{padding:'48px 24px',textAlign:'center',color:'var(--ink-400)'}}>
          Loading order detail…
        </div>
      )}

      {error && (
        <div style={{padding:'48px 24px',textAlign:'center',color:'var(--red-600)'}}>
          {error}
        </div>
      )}

      {detail && (
        <>
          <div className="section-anchors">
            <a href="#sec-activity" className="anchor">{DI.message}<span>{t.secActivity || 'Activity'}</span><span className="pill">{detail.comments.length}</span></a>
            <a href="#sec-phases" className="anchor">{DI.layers}<span>{t.secPhases || 'Phases & timing'}</span><span className="pill">{detail.phases.length}</span></a>
            <a href="#sec-materials" className="anchor">{DI.package}<span>{t.tabMaterials}</span><span className="pill">{detail.materials.length}</span></a>
            <a href="#sec-qa" className="anchor">{DI.beaker}<span>{t.secInspections || 'Inspections'}</span><span className="pill">{detail.inspections.length}</span></a>
          </div>

          <div className="all-sections">
            <section id="sec-activity" className="section-block">
              <SectionHeader icon={DI.message} label={t.secActivity || 'Activity'} />
              <ActivitySection detail={detail} t={t} />
            </section>

            <section id="sec-phases" className="section-block">
              <SectionHeader icon={DI.layers} label={t.secPhases || 'Phases & timing'} />
              <PhasesSection detail={detail} t={t} />
            </section>

            <section id="sec-materials" className="section-block">
              <SectionHeader icon={DI.package} label={t.tabMaterials} />
              <MaterialsSection detail={detail} t={t} />
            </section>

            <section id="sec-qa" className="section-block">
              <SectionHeader icon={DI.beaker} label={t.secInspections || 'Inspections'} />
              <InspectionsSection detail={detail} t={t} view={insView} setView={setInsView} />
            </section>
          </div>
        </>
      )}

      {tweaksOpen && (
        <TweaksPanel
          insView={insView} setInsView={(v) => {
            setInsView(v);
            window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { insView: v } }, '*');
          }}
          onClose={() => {
            setTweaksOpen(false);
            window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
          }}
        />
      )}
    </>
  );
}

// ----- Summary strip -----
function SummaryStrip({ detail, t }) {
  const { qtyIssuedKg, qtyReceivedKg } = detail.movementSummary;
  const yieldStr = qtyReceivedKg && qtyIssuedKg ? ((qtyReceivedKg / qtyIssuedKg) * 100).toFixed(1) : null;
  const o = detail.order;
  const cells = [
    { label: t.sumPOID || 'Process order',   value: <span style={{fontFamily:'var(--font-mono)'}}>{o.processOrderId}</span>, sub: o.plantId },
    { label: t.sumStatus || 'Order status',   value: <StatusBadge status={o.status} interactive={false} />, sub: o.rawStatus, valueRaw: true },
    { label: t.sumMaterial || 'Material',     value: <span style={{fontFamily:'var(--font-mono)',fontSize:15}}>{o.materialId}</span>, sub: o.materialCategory || '—' },
    { label: t.sumBatch || 'Batch ID',        value: <span style={{fontFamily:'var(--font-mono)',fontSize:15}}>{o.batchId || '—'}</span>, sub: o.supplierBatchId ? 'Supplier ' + o.supplierBatchId : '—' },
    { label: t.sumQtyIssued || 'Qty issued',  value: <>{fmtKg(qtyIssuedKg)}<span className="unit">kg</span></>,   sub: detail.materials.length + ' components · ' + detail.movements.length + ' movements' },
    { label: t.sumQtyReceived || 'Qty received', value: <>{fmtKg(qtyReceivedKg)}<span className="unit">kg</span></>, sub: o.status === 'running' ? 'In progress' : '101 receipt to FG' },
    { label: t.sumYieldShort || 'Yield',      value: yieldStr ? yieldStr + '%' : '—', sub: t.sumYieldTarget, valueColor: yieldStr ? (Number(yieldStr) >= 95 ? '#1F6E4A' : '#8B6E0C') : 'var(--ink-400)' },
    { label: t.sumSetupTime || 'Setup time',  value: fmtSeconds(detail.timeSummary.setupS), sub: 'Σ across phases', mono: true },
    { label: t.sumMachineTime || 'Machine time', value: fmtSeconds(detail.timeSummary.machS), sub: 'Σ across phases', mono: true },
    { label: t.sumCleaningTime || 'Cleaning time', value: fmtSeconds(detail.timeSummary.cleanS), sub: 'Σ across phases', mono: true },
  ];
  return (
    <div className="summary-strip">
      {cells.map((c, i) => (
        <div className="sum-cell" key={i}>
          <div className="label">{c.label}</div>
          <div className="value" style={{
            color: c.valueColor || undefined,
            fontFamily: c.mono ? 'var(--font-mono)' : undefined,
            fontSize: c.mono ? 16 : undefined,
            fontWeight: c.mono ? 500 : undefined,
          }}>{c.value}</div>
          <div className="sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ----- Sub meta strip (DOM / expiry / inspection lot) -----
function SubMetaStrip({ detail, t }) {
  const o = detail.order;
  return (
    <div className="submeta-strip">
      <div className="sm-pill">
        <span className="sm-icon">{DI.calendar}</span>
        <div className="sm-body">
          <div className="sm-label">{t.sumDOM || 'Date of manufacture'}</div>
          <div className="sm-value">{fmtDate(o.manufactureDateMs)}</div>
        </div>
      </div>
      <div className="sm-pill">
        <span className="sm-icon">{DI.calendar}</span>
        <div className="sm-body">
          <div className="sm-label">{t.sumExpiry || 'Shelf life expiry'}</div>
          <div className="sm-value">{fmtDate(o.expiryDateMs)}</div>
        </div>
      </div>
      <div className="sm-pill" style={{marginLeft:'auto'}}>
        <span className="sm-icon">{DI.shield}</span>
        <div className="sm-body">
          <div className="sm-label">Inspection lot</div>
          <div className="sm-value mono">{o.inspectionLotId || '—'}</div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div className="section-header">
      <span className="section-icon">{icon}</span>
      <h2 className="section-title">{label}</h2>
      <span className="section-rule" />
    </div>
  );
}

// ----- Activity section (operator notes + side cards) -----
function ActivitySection({ detail, t }) {
  return (
    <div className="detail-grid timeline-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.message}<h3>{t.cardComments || 'Operator notes'}</h3>
          <span className="meta">{detail.comments.length}</span>
        </div>
        <div className="comments-list">
          {detail.comments.length === 0 ? (
            <div className="empty-state">{t.noComments}</div>
          ) : detail.comments.map((c, i) => (
            <div key={i} className="comment-row">
              <div className="comment-head">
                <span className="comment-author">{c.sender || '—'}</span>
                <span className="comment-time">
                  {fmtDateTime(c.createdMs)}
                  {c.phaseId ? ' · phase ' + c.phaseId : ''}
                </span>
              </div>
              <div className="comment-body">{c.notes}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="side-stack">
        <DowntimeCard detail={detail} t={t} />
        <EquipmentCard detail={detail} t={t} />
      </div>
    </div>
  );
}

function DowntimeCard({ detail, t }) {
  const totalDur = detail.downtime.reduce((a, d) => a + d.durationS, 0);
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.alert}<h3>{t.cardDowntime || 'Downtime & issues'}</h3>
        <span className="meta">{detail.downtime.length === 0 ? 'none' : detail.downtime.length + ' · ' + Math.round(totalDur / 60) + ' min'}</span>
      </div>
      {detail.downtime.length === 0 ? (
        <div className="empty-state">{t.noDowntime || 'No downtime recorded.'}</div>
      ) : (
        <ul className="issue-list">
          {detail.downtime.map((d, i) => (
            <li key={i} className="issue-row">
              <div className="issue-tag">{d.issueType}</div>
              <div className="issue-body">
                <div className="issue-title">{d.issueTitle}</div>
                <div className="issue-meta">
                  <span className="mono">{Math.round(d.durationS / 60)}m</span>
                  <span>·</span>
                  <span>{d.reasonCode}/{d.subReasonCode}</span>
                  <span>·</span>
                  <span>{fmtDateTime(d.startTimeMs)}</span>
                </div>
                {d.operatorsComments && <div className="issue-comment">{d.operatorsComments}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquipmentCard({ detail, t }) {
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.cpu}<h3>{t.cardEquipment || 'Equipment activity'}</h3>
        <span className="meta">{detail.equipment.length}</span>
      </div>
      {detail.equipment.length === 0 ? (
        <div className="empty-state">{t.noEquipment}</div>
      ) : (
        <ul className="eq-list">
          {detail.equipment.map((e, i) => (
            <li key={i} className="eq-row">
              <div className="eq-instr">
                <span className="eq-type">{e.equipmentType}</span>
                <span className="eq-id mono">{e.instrumentId}</span>
              </div>
              <div className="eq-trans">
                <span className="eq-from">{e.statusFrom}</span>
                <span className="eq-arrow">{DI.arrowR}</span>
                <span className="eq-to">{e.statusTo}</span>
              </div>
              <div className="eq-time">{fmtDateTime(e.changeAtMs)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----- Phases section -----
function PhasesSection({ detail, t }) {
  const phases = detail.phases;
  const maxDurH = Math.max(...phases.map(p => (p.setupS + p.machS + p.cleanS) / 3600), 0.001);

  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.layers}<h3>{t.cardPhaseList || 'Process phases'}</h3>
        <span className="meta">
          {phases.length} phases · {fmtSeconds(detail.timeSummary.setupS + detail.timeSummary.machS + detail.timeSummary.cleanS)}
        </span>
        <div className="phase-legend">
          <span className="leg leg-setup"><i /> {t.phaseSetup}</span>
          <span className="leg leg-mach"><i /> {t.phaseMachine}</span>
          <span className="leg leg-clean"><i /> {t.phaseCleaning}</span>
        </div>
      </div>

      <table className="phase-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18, width:80}}>{t.phaseColId}</th>
            <th>{t.phaseColDesc}</th>
            <th className="right" style={{width:130}}>{t.phaseColQty}</th>
            <th style={{width:110}}>{t.phaseColStartUser}</th>
            <th style={{width:110}}>{t.phaseColEndUser}</th>
            <th style={{width:340, paddingRight:18}}>{t.phaseColTime}</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((p) => {
            const setupH = p.setupS / 3600;
            const machH  = p.machS  / 3600;
            const cleanH = p.cleanS / 3600;
            const totalH = setupH + machH + cleanH;
            return (
              <tr key={p.phaseId}>
                <td style={{paddingLeft:18}}>
                  <span className="phase-id mono">{p.phaseId}</span>
                </td>
                <td>
                  <div className="mat-name">{p.phaseDescription}</div>
                  <div className="mat-sub">{p.phaseText}</div>
                </td>
                <td className="right mono">
                  {p.operationQuantity.toLocaleString()} <span style={{color:'var(--ink-400)',fontSize:11}}>{p.operationQuantityUom}</span>
                </td>
                <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{p.startUser || '—'}</td>
                <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{p.endUser || '—'}</td>
                <td style={{paddingRight:18}}>
                  <div className="phase-bar-wrap">
                    <div className="phase-bar">
                      <div className="bar-setup" style={{width: (setupH / maxDurH * 100) + '%'}} title={`Setup ${setupH.toFixed(2)}h`} />
                      <div className="bar-mach"  style={{width: (machH  / maxDurH * 100) + '%'}} title={`Machine ${machH.toFixed(2)}h`} />
                      <div className="bar-clean" style={{width: (cleanH / maxDurH * 100) + '%'}} title={`Cleaning ${cleanH.toFixed(2)}h`} />
                    </div>
                    <div className="phase-bar-meta mono">{totalH.toFixed(2)} h</div>
                  </div>
                </td>
              </tr>
            );
          })}
          <tr style={{background:'var(--stone)',fontWeight:600}}>
            <td style={{paddingLeft:18}} colSpan={5}>{t.phaseTotal}</td>
            <td style={{paddingRight:18}}>
              <div className="phase-bar-wrap">
                <div className="phase-time-pills">
                  <span className="pill-setup mono">{fmtSeconds(detail.timeSummary.setupS)}</span>
                  <span className="pill-mach mono">{fmtSeconds(detail.timeSummary.machS)}</span>
                  <span className="pill-clean mono">{fmtSeconds(detail.timeSummary.cleanS)}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ----- Materials & Movements section -----
function MaterialsSection({ detail, t }) {
  const totalQty = detail.materials.reduce((a, m) => a + m.totalQty, 0);
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.package}<h3>{t.cardBOM}</h3>
        <span className="meta">{detail.materials.length} {t.items} · {totalQty.toFixed(3)} kg {t.consumed}</span>
      </div>
      <table className="mat-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18}}>{t.matMaterial}</th>
            <th>{t.matLotSupplier || 'Batch'}</th>
            <th className="right">{t.matActual || 'Qty used'}</th>
            <th className="right" style={{paddingRight:18}}>{t.matUnit || 'UOM'}</th>
          </tr>
        </thead>
        <tbody>
          {detail.materials.map((m, i) => (
            <tr key={i}>
              <td style={{paddingLeft:18}}>
                <div className="mat-name">{m.materialName || m.materialId}</div>
                <div className="mat-sub mono">{m.materialId}</div>
              </td>
              <td>
                <div className="mat-name mono" style={{fontSize:12.5,fontWeight:400,color:'var(--forest)'}}>{m.batchId || '—'}</div>
              </td>
              <td className="right mono">{m.totalQty.toFixed(3)}</td>
              <td className="right" style={{paddingRight:18,color:'var(--ink-500)',fontFamily:'var(--font-mono)',fontSize:11.5}}>{m.uom}</td>
            </tr>
          ))}
          <tr style={{background:'var(--stone)',fontWeight:600}}>
            <td style={{paddingLeft:18,fontWeight:600}} colSpan={2}>{t.matTotal}</td>
            <td className="right">{totalQty.toFixed(3)}</td>
            <td className="right" style={{paddingRight:18,color:'var(--ink-500)',fontFamily:'var(--font-mono)',fontSize:11.5}}>kg</td>
          </tr>
        </tbody>
      </table>

      <div className="detail-card-head" style={{borderTop:'1px solid var(--stone-100)',marginTop:0}}>
        {DI.arrowR}<h3>{t.cardMovements || 'Material movements'}</h3>
        <span className="meta">{detail.movements.length} entries</span>
      </div>
      <table className="mov-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18, width:130}}>{t.movColDate}</th>
            <th style={{width:60}}>{t.movColType}</th>
            <th>{t.movColMaterial}</th>
            <th className="mono" style={{width:130}}>{t.movColBatch}</th>
            <th className="right" style={{width:110}}>{t.movColQty}</th>
            <th style={{width:80}}>{t.movColStorage}</th>
            <th style={{width:120, paddingRight:18}}>{t.movColUser}</th>
          </tr>
        </thead>
        <tbody>
          {detail.movements.map((mv, i) => (
            <tr key={i}>
              <td className="mono" style={{paddingLeft:18,fontSize:11.5,color:'var(--ink-500)'}}>{fmtDateTime(mv.dateTimeOfEntry)}</td>
              <td>
                <span className={`mvt-pill ${mv.movementType === '101' ? 'receipt' : 'issue'}`}>{mv.movementType}</span>
              </td>
              <td>
                <div className="mat-name" style={{fontSize:13}}>{mv.materialName || mv.materialId}</div>
                <div className="mat-sub mono">{mv.materialId}</div>
              </td>
              <td className="mono" style={{fontSize:11.5,color:'var(--forest)'}}>{mv.batchId || '—'}</td>
              <td className="right mono">{mv.quantity.toLocaleString('en-US', {minimumFractionDigits:3,maximumFractionDigits:3})} <span style={{color:'var(--ink-400)',fontSize:11}}>{mv.uom}</span></td>
              <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{mv.storageId || '—'}</td>
              <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)',paddingRight:18}}>{mv.userName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----- Inspections section -----
function InspectionsSection({ detail, t, view, setView }) {
  const allPass = detail.inspections.length > 0 && detail.inspections.every(x => x.judgement === 'A');
  return (
    <div className="detail-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.beaker}<h3>{t.cardInspectionResults || 'Inspection results'}</h3>
          <span className="meta">
            {detail.inspections.length === 0 ? 'No results' : allPass ? t.allWithinSpec : 'Has rejections'}
          </span>
          <div className="view-toggle">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>{t.viewTable || 'Table'}</button>
            <button className={view === 'tiles' ? 'active' : ''} onClick={() => setView('tiles')}>{t.viewTiles || 'Tiles'}</button>
          </div>
        </div>

        {view === 'table' ? (
          <table className="ins-tbl">
            <thead>
              <tr>
                <th style={{paddingLeft:18, width:100}}>ID</th>
                <th>{t.insColChar}</th>
                <th>{t.insColSpec}</th>
                <th style={{width:110}}>{t.insColResult}</th>
                <th style={{width:90}}>{t.insColSample}</th>
                <th style={{width:80, paddingRight:18}}>{t.insColJudge}</th>
              </tr>
            </thead>
            <tbody>
              {detail.inspections.map((ins, i) => (
                  <tr key={i}>
                    <td style={{paddingLeft:18}} className="mono">{ins.characteristicId}</td>
                    <td>
                      <div className="mat-name" style={{fontSize:13}}>{ins.characteristicDescription}</div>
                    </td>
                    <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{ins.specification || '—'}</td>
                    <td>
                      {ins.qualitativeResult ? (
                        <span className={`qual-result ${ins.judgement === 'A' ? 'pass' : 'fail'}`}>
                          {ins.qualitativeResult}
                        </span>
                      ) : ins.quantitativeResult != null ? (
                        <span className="mono" style={{fontSize:13,fontWeight:500}}>
                          {ins.quantitativeResult} <span style={{color:'var(--ink-400)',fontSize:11}}>{ins.uom}</span>
                        </span>
                      ) : (
                        <span style={{color:'var(--ink-400)'}}>—</span>
                      )}
                    </td>
                    <td className="mono" style={{fontSize:11.5}}>{ins.sampleId || '—'}</td>
                    <td style={{paddingRight:18}}>
                      <span className={`judge-pill ${ins.judgement === 'A' ? 'pass' : 'fail'}`}>{ins.judgement}</span>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="qa-grid">
            {detail.inspections.map((ins, i) => {
              const result = ins.qualitativeResult
                ? ins.qualitativeResult
                : ins.quantitativeResult != null ? ins.quantitativeResult : null;
              return (
                <div key={i} className="qa-cell">
                  <div className="label">{ins.characteristicDescription}</div>
                  <div className={`val ${ins.judgement === 'A' ? 'pass' : 'fail'}`}>
                    {result ?? '—'}{ins.uom && <span style={{fontSize:13,color:'var(--ink-500)',marginLeft:3}}>{ins.uom}</span>}
                  </div>
                  <div className="target mono">{ins.specification}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="side-stack">
        <UsageDecisionCard ud={detail.usageDecision} t={t} />
      </div>
    </div>
  );
}

function UsageDecisionCard({ ud, t }) {
  if (!ud) {
    return (
      <div className="detail-card ud-card pending">
        <div className="detail-card-head">{DI.flag}<h3>{t.cardUsageDecision || 'Usage decision'}</h3></div>
        <div className="ud-body">
          <div className="ud-pending">{t.udPending || 'Pending decision'}</div>
          <div className="ud-sub">Awaiting QA review · no decision recorded yet.</div>
        </div>
      </div>
    );
  }
  const accepted = ud.valuationCode === 'A';
  return (
    <div className={`detail-card ud-card ${accepted ? 'accept' : 'reject'}`}>
      <div className="detail-card-head">
        {DI.flag}<h3>{t.cardUsageDecision || 'Usage decision'}</h3>
        <span className={`ud-badge ${accepted ? 'accept' : 'reject'}`}>{accepted ? 'A' : 'R'}</span>
      </div>
      <div className="ud-body">
        <div className="ud-headline">{ud.usageDecisionCode || '—'}</div>
        <div className="ud-meta-grid">
          <div><div className="ud-l">{t.udCode}</div><div className="ud-v mono">{ud.usageDecisionCode || '—'}</div></div>
          <div><div className="ud-l">{t.udValuation}</div><div className="ud-v mono">{ud.valuationCode || '—'}</div></div>
          <div><div className="ud-l">{t.udQualityScore}</div><div className="ud-v mono" style={{fontSize:18,fontWeight:600,color:accepted?'#1F6E4A':'#A74545'}}>{ud.qualityScore ?? '—'}</div></div>
        </div>
        <div className="ud-foot">
          {t.udBy} <strong>{ud.createdBy || '—'}</strong> {t.udOn} {fmtDate(ud.createdDateMs)}
        </div>
      </div>
    </div>
  );
}

// ----- Docs (no live data source — placeholder) -----
function DocsSection({ t }) {
  return (
    <div className="detail-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.fileText}<h3>{t.cardDocs}</h3>
          <span className="meta">0 {t.files}</span>
        </div>
        <div className="empty-state" style={{padding:'24px 18px'}}>{t.noDocs || 'No documents attached.'}</div>
      </div>

      <div className="side-stack">
      </div>
    </div>
  );
}

// ----- Tweaks panel -----
function TweaksPanel({ insView, setInsView, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span style={{fontFamily:'var(--font-impact)',fontWeight:800,textTransform:'uppercase',fontSize:13,letterSpacing:'.02em'}}>Tweaks</span>
        <button className="tweaks-close" onClick={onClose} aria-label="Close">{DI.x}</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-section">
          <div className="tweak-label">Inspection results layout</div>
          <div className="tweak-radio">
            <button className={insView === 'table' ? 'active' : ''} onClick={() => setInsView('table')}>Table</button>
            <button className={insView === 'tiles' ? 'active' : ''} onClick={() => setInsView('tiles')}>Tiles</button>
          </div>
          <div className="tweak-help">Switch between a dense data table (default) and KPI-style tiles for the inspection characteristics.</div>
        </div>
      </div>
    </div>
  );
}

export { OrderDetail }
