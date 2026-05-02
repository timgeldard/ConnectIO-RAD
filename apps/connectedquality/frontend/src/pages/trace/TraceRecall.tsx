import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const COUNTRIES = [
  { n: 'Germany', q: 4820, p: 0.32 },
  { n: 'France', q: 3110, p: 0.21 },
  { n: 'Spain', q: 2440, p: 0.16 },
  { n: 'United Kingdom', q: 1980, p: 0.13 },
  { n: 'Italy', q: 1240, p: 0.08 },
  { n: 'Netherlands', q: 740, p: 0.05 },
  { n: 'Belgium', q: 410, p: 0.03 },
  { n: 'Poland', q: 290, p: 0.02 },
]

const CUSTOMERS = [
  { n: 'Müller Foods GmbH', s: 0.28, c: '#005776' },
  { n: 'Lactalis France', s: 0.19, c: '#289BA2' },
  { n: 'Pascual Iberica SAU', s: 0.14, c: '#44CF93' },
  { n: 'Arla UK Ltd', s: 0.11, c: '#F9C20A' },
  { n: 'FrieslandCampina', s: 0.09, c: '#F24A00' },
  { n: 'Danone Italia', s: 0.07, c: '#143700' },
  { n: 'Ehrmann AG', s: 0.07, c: '#8A6CD1' },
  { n: 'Yoplait SAS', s: 0.05, c: '#A4CFD8' },
]

const DELIVERIES = [
  { d: '8030054411', c: 'Müller Foods GmbH', loc: 'Aretsried · DE', ctr: 'DE', date: '2026-04-21', q: 1840.0, s: 'good', doc: 'INV-44120' },
  { d: '8030054512', c: 'Lactalis France', loc: 'Laval · FR', ctr: 'FR', date: '2026-04-22', q: 1220.0, s: 'good', doc: 'INV-44141' },
  { d: '8030054613', c: 'Pascual Iberica SAU', loc: 'Aranda · ES', ctr: 'ES', date: '2026-04-23', q: 980.5, s: 'warn', doc: 'INV-44162' },
  { d: '8030054714', c: 'Arla UK Ltd', loc: 'Settle · GB', ctr: 'GB', date: '2026-04-24', q: 712.0, s: 'good', doc: 'INV-44183' },
  { d: '8030054815', c: 'FrieslandCampina', loc: 'Wageningen · NL', ctr: 'NL', date: '2026-04-25', q: 484.0, s: 'good', doc: 'INV-44204' },
  { d: '8030054916', c: 'Danone Italia', loc: 'Casale · IT', ctr: 'IT', date: '2026-04-26', q: 340.0, s: 'warn', doc: 'INV-44225' },
  { d: '8030055017', c: 'Ehrmann AG', loc: 'Oberschönegg · DE', ctr: 'DE', date: '2026-04-26', q: 280.0, s: 'bad', doc: 'INV-44246' },
  { d: '8030055118', c: 'Yoplait SAS', loc: 'Le Mans · FR', ctr: 'FR', date: '2026-04-28', q: 210.0, s: 'good', doc: 'INV-44267' },
]

/** Trace Recall Readiness — forward exposure across customers, countries, and deliveries. */
export function TraceRecall() {
  return (
    <div className="cq-page">
      <PageHead
        eyebrow="TRACE · MODULE 01 · PAGE 02"
        title="RECALL READINESS"
        desc="Forward exposure across customers, countries, and downstream batches. Run a recall simulation to highlight contaminated routes."
        actions={
          <>
            <button className="cq-btn"><Icon name="dl" size={12} /> Export dossier</button>
            <button className="cq-btn danger"><Icon name="alert" size={12} /> Simulate recall</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 10 }}>
        <KPI label="Batch status" value={<Pill kind="warn">QI · Hold</Pill>} />
        <KPI label="Days to expiry" value="354" unit="d" sub="2026-04-12 → 2027-04-12" />
        <KPI label="Unrestricted" value="12,840" unit="kg" tone="good" sub="UNRESTRICTED-100" />
        <KPI label="Blocked" value="1,440" unit="kg" tone="bad" sub="HOLD CODE 04" />
        <KPI label="QI hold" value="3,200" unit="kg" tone="warn" sub="Pending micro" />
        <KPI label="Process order" value={<span className="mono" style={{ fontSize: 16 }}>17402114</span>} sub="Charleville · IE" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 22 }}>
        <KPI label="Customers affected" value="11" />
        <KPI label="Countries affected" value="8" />
        <KPI label="Total shipped" value="15,030" unit="kg" />
        <KPI label="Deliveries" value="42" />
        <KPI label="Consumed internally" value="2,810" unit="kg" />
        <KPI label="Consuming POs" value="3" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
        <Card title="Shipped — by country" num="A" meta="8 COUNTRIES">
          <svg viewBox="0 0 600 260" style={{ width: '100%', height: 260 }}>
            {COUNTRIES.map((c, i) => {
              const w = (c.q / COUNTRIES[0].q) * 420
              return (
                <g key={i} transform={`translate(0 ${i * 30 + 6})`}>
                  <text x={140} y={16} textAnchor="end" className="axis-text" style={{ fill: 'var(--cq-fg-2)', fontSize: 11 }}>{c.n}</text>
                  <rect x={148} y={4} width={w} height={20} fill="var(--cq-accent)" opacity={0.85} />
                  <text x={148 + w + 6} y={16} className="axis-text tabular" style={{ fill: 'var(--cq-fg-2)', fontSize: 11 }}>{c.q.toLocaleString()} KG · {(c.p * 100).toFixed(0)}%</text>
                </g>
              )
            })}
          </svg>
        </Card>

        <Card title="Shipped — by customer" num="B" meta="TOP 8 OF 11">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <svg viewBox="0 0 220 220" width="220" height="220">
              {(() => {
                let acc = 0
                const cx = 110, cy = 110, R = 90, r = 56
                return CUSTOMERS.map((c, i) => {
                  const start = acc * Math.PI * 2 - Math.PI / 2
                  acc += c.s
                  const end = acc * Math.PI * 2 - Math.PI / 2
                  const large = c.s > 0.5 ? 1 : 0
                  const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start)
                  const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end)
                  const x3 = cx + r * Math.cos(end), y3 = cy + r * Math.sin(end)
                  const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start)
                  const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`
                  return <path key={i} d={d} fill={c.c} />
                })
              })()}
              <text x={110} y={104} textAnchor="middle" style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 22, fill: 'var(--cq-fg)' }}>15,030</text>
              <text x={110} y={122} textAnchor="middle" className="axis-text" style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>kg dispatched</text>
            </svg>
            <div style={{ flex: 1, display: 'grid', gap: 5 }}>
              {CUSTOMERS.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                  <span style={{ width: 10, height: 10, background: c.c, borderRadius: 2 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
                  <span className="mono" style={{ color: 'var(--cq-fg-2)' }}>{(c.s * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Shipment events" num="C" meta="42 DELIVERIES · SORTED BY DATE"
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="cq-chip active">All</span>
            <span className="cq-chip">Critical</span>
            <span className="cq-chip">High</span>
            <span className="cq-chip">Medium</span>
          </div>
        }
        bodyClass="tight"
      >
        <table className="cq-tbl">
          <thead>
            <tr>
              <th>Delivery</th><th>Customer</th><th>Destination</th><th>Country</th>
              <th>Date</th><th style={{ textAlign: 'right' }}>Qty (KG)</th>
              <th>Status</th><th>Doc</th>
            </tr>
          </thead>
          <tbody>
            {DELIVERIES.map((r, i) => (
              <tr key={i} className={r.s === 'bad' ? 'flagged' : ''}>
                <td className="mono">{r.d}</td>
                <td>{r.c}</td>
                <td className="muted">{r.loc}</td>
                <td className="mono">{r.ctr}</td>
                <td className="mono muted">{r.date}</td>
                <td className="num">{r.q.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                <td>
                  <Pill kind={r.s as 'good' | 'warn' | 'bad'}>
                    {r.s === 'good' ? 'Delivered' : r.s === 'warn' ? 'In transit' : 'Recall'}
                  </Pill>
                </td>
                <td className="mono muted">{r.doc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
