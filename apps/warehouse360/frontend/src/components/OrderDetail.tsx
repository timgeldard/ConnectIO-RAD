/* eslint-disable @typescript-eslint/no-explicit-any */
import { Icon, Pill, Progress } from './Primitives'
import { Card } from './Shared'
import { fmtTime, minutesFromNow } from '~/utils/time'

/* Production Order staging detail — drawer contents */

/** Props for the OrderStagingDetail drawer content. */
interface OrderStagingDetailProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order?: any
}

const OrderStagingDetail = ({ order }: OrderStagingDetailProps) => {
  if (!order) return null;
  const tr: any[] = [];
  const to: any[] = [];
  const hu: any[] = [];
  const disp: any[] = [];

  const minsToStart = order.start ? minutesFromNow(order.start) : null;
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="scale-card">
          <div className="t-eyebrow">Start</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, textTransform: 'uppercase', fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{order.start ? fmtTime(order.start) : '—'}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {minsToStart === null ? '—' : minsToStart < 0 ? Math.abs(minsToStart) + ' min in production' : 'starts in ' + minsToStart + ' min'}
          </div>
        </div>
        <div className="scale-card">
          <div className="t-eyebrow">Staging</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, textTransform: 'uppercase', fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{order.stagingPct}%</div>
          <Progress pct={order.stagingPct} tone={order.stagingPct < 70 ? 'red' : order.stagingPct < 95 ? 'amber' : ''}/>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{order.palletsStaged}/{order.pallets} pallets · {order.bomPicked}/{order.bomCount} BOM lines</div>
        </div>
      </div>

      <div className="stack-16">
        {/* Summary facts */}
        <Card title="Order context" eyebrow="AFKO · AFPO · RESB" tight>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {[
              ['Product', order.product],
              ['Line', order.line.name + ' · ' + order.line.area],
              ['Staging method', order.method.label],
              ['Duration', order.duration != null ? order.duration + ' min' : '—'],
              ['Shift', order.shift.label + ' ' + order.shift.hours],
              ['Pallets planned', order.pallets + ' pal'],
              ['Batch critical', order.batchCritical ? 'Yes — batch must match reservation' : 'No'],
              ['Dispensary required', order.dispensaryRequired ? 'Yes — weighed micros' : 'No'],
              ['SAP order', order.sapOrder],
            ].map(([k, v], i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i > 5 ? 'none' : '1px solid var(--stroke-soft)', borderRight: i % 3 !== 2 ? '1px solid var(--stroke-soft)' : 'none' }}>
                <div className="t-eyebrow" style={{ marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </dl>
        </Card>

        {/* Materials */}
        <Card title="Materials outstanding" subtitle={`${tr.length} open transfer requirements · ${order.bomCount - order.bomPicked} BOM lines remaining`}
          eyebrow="LTBK / RESB"
          actions={<button className="btn btn-sm btn-secondary"><Icon name="refresh" size={12}/> Re-plan</button>}
          tight>
          <table className="tbl">
            <thead>
              <tr>
                <th>TR</th>
                <th>Material</th>
                <th className="num">Qty</th>
                <th>Source</th>
                <th>Dest</th>
                <th>Status</th>
                <th className="num">Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tr.map((t: any, i: number) => (
                <tr key={i}>
                  <td><span className="code">{t.id}</span></td>
                  <td>
                    <div className="primary" style={{ fontSize: 12 }}>{t.material.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{t.material.id}</div>
                  </td>
                  <td className="num">{t.qty} {t.uom}</td>
                  <td><span className="tag">ST {t.srcType}</span></td>
                  <td><span className="tag tag-slate">ST {t.dstType}</span></td>
                  <td><Pill tone={t.status === 'Confirmed' ? 'green' : t.status === 'Open' ? 'amber' : t.status === 'Exception' ? 'red' : 'slate'}>{t.status}</Pill></td>
                  <td className="num">{t.ageMin}m</td>
                  <td><button className="btn btn-xs btn-ghost"><Icon name="chevronRight" size={12}/></button></td>
                </tr>
              ))}
              {tr.length === 0 && (
                <tr><td colSpan={8} className="muted small">No live transfer requirements are available for this order.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {order.dispensaryRequired && (
          <Card title="Dispensary weighing" subtitle={`${disp.length} micro-ingredients to weigh · tolerance ± 0.5%`}
            eyebrow="Dispensary">
            <div className="stack-8">
              {disp.map((d: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px 100px', gap: 12, alignItems: 'center', fontSize: 12 }}>
                  <div>
                    <div className="primary">{d.material.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{d.material.id} · Batch {d.batch}</div>
                  </div>
                  <div className="mono right">{d.qty} kg</div>
                  <div><Progress pct={d.status === 'Weighed' ? 100 : d.status === 'Weighing' ? 55 : 0} tone={d.status === 'Weighed' ? '' : 'amber'}/></div>
                  <div className="mono" style={{ textAlign: 'right' }}>{d.scale}</div>
                  <div><Pill tone={d.status === 'Weighed' ? 'green' : d.status === 'Weighing' ? 'amber' : 'grey'}>{d.status}</Pill></div>
                </div>
              ))}
              {disp.length === 0 && <div className="muted small">No live dispensary task detail is available for this order.</div>}
            </div>
          </Card>
        )}

        {/* HUs / SSCCs */}
        <Card title="Handling units on this order" subtitle={`${hu.length} SSCC pallets linked · last scan trace below`} eyebrow="VEKP / VEPO" tight>
          <table className="tbl">
            <thead>
              <tr><th>SSCC</th><th>Material</th><th className="num">Qty</th><th>Bin</th><th>Status</th><th>Last scan</th></tr>
            </thead>
            <tbody>
              {hu.map((h: any, i: number) => (
                <tr key={i}>
                  <td className="code">{h.sscc}</td>
                  <td><div style={{ fontSize: 12 }}>{h.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{h.material.id}</div></td>
                  <td className="num">{h.qty} {h.uom}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{h.bin}</td>
                  <td><Pill tone={h.status === 'Active' ? 'slate' : h.status === 'On Line' ? 'sage' : 'grey'}>{h.status}</Pill></td>
                  <td className="muted small">{fmtTime(h.lastScan)}</td>
                </tr>
              ))}
              {hu.length === 0 && (
                <tr><td colSpan={6} className="muted small">No live handling units are available for this order.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Transfer Orders */}
        <Card title="Warehouse tasks" subtitle="LTAK/LTAP — open & recently confirmed" eyebrow="Transfer Orders" tight>
          <table className="tbl">
            <thead>
              <tr><th>TO</th><th>Type</th><th>Material</th><th className="num">Qty</th><th>Src</th><th>Dst</th><th>Operator</th><th>Status</th></tr>
            </thead>
            <tbody>
              {to.map((t: any, i: number) => (
                <tr key={i}>
                  <td className="code">{t.id}</td>
                  <td><span className="tag">{t.type}</span></td>
                  <td><div style={{ fontSize: 12 }}>{t.material.name}</div></td>
                  <td className="num">{t.qty} {t.uom}</td>
                  <td className="mono small">{t.srcBin}</td>
                  <td className="mono small">{t.dstBin}</td>
                  <td className="small">{t.assignedTo || <span className="muted">unassigned</span>}</td>
                  <td><Pill tone={t.status === 'Confirmed' ? 'green' : t.status === 'Exception' ? 'red' : t.status === 'Open' ? 'amber' : 'slate'}>{t.status}</Pill></td>
                </tr>
              ))}
              {to.length === 0 && (
                <tr><td colSpan={8} className="muted small">No live transfer orders are available for this order.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Risk + suggested action */}
        {order.risk !== 'green' && (
          <div className="card" style={{ borderColor: order.risk === 'red' ? 'var(--sunset)' : 'var(--sunrise)', background: 'color-mix(in srgb, ' + (order.risk === 'red' ? 'var(--sunset)' : 'var(--sunrise)') + ' 6%, white)' }}>
            <div className="card-body">
              <div className="t-eyebrow" style={{ color: order.risk === 'red' ? 'var(--sunset)' : 'var(--forest)' }}>Suggested action</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.4, color: 'var(--forest)', marginTop: 6, maxWidth: 560 }}>
                {order.risk === 'red'
                  ? 'Escalate to the shift supervisor and confirm staging recovery actions against live warehouse tasks.'
                  : order.start ? 'Confirm required staging activity before ' + fmtTime(new Date(order.start.getTime() - 30 * 60000)) + ' to stay on track.' : 'Confirm required staging activity is on schedule.'}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm"><Icon name="check" size={12}/> Acknowledge</button>
                <button className="btn btn-secondary btn-sm"><Icon name="user" size={12}/> Reassign</button>
                <button className="btn btn-ghost btn-sm"><Icon name="chat" size={12}/> Note supervisor</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};


export { OrderStagingDetail };
