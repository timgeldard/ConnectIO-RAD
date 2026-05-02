import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const ROWS = [
  { sev: 'bad',  src: 'TRACE',  rule: 'Recall simulated',      sub: 'MAT 20582002 / BAT 0008898869', site: 'Charleville', own: 'S. Keane',  age: '2m',  st: 'open' },
  { sev: 'bad',  src: 'SPC',    rule: 'Hotelling T² > 0.99',   sub: 'Spray dryer outlet · L4',       site: 'Carrigaline', own: 'P. Murray', age: '32m', st: 'ack' },
  { sev: 'warn', src: 'ENVMON', rule: 'Listeria · 3↗ rising',  sub: 'F2 · RTE-3 · L03',             site: 'Listowel',    own: 'K. Ahern',  age: '14m', st: 'open' },
  { sev: 'warn', src: 'TRACE',  rule: 'Mass-bal var > 0.5kg',  sub: 'BAT 0008898870',                site: 'Charleville', own: 'S. Keane',  age: '1h',  st: 'open' },
  { sev: 'warn', src: 'SPC',    rule: 'WECO 4 · 8 in trend',   sub: 'X̄-R viscosity · L4',          site: 'Hamburg',     own: 'F. Krebs',  age: '1h',  st: 'open' },
  { sev: 'warn', src: 'SPC',    rule: 'Nelson 5 · 2 of 3 > 2σ', sub: 'Outlet temp · L4',            site: 'Carrigaline', own: 'P. Murray', age: '2h',  st: 'ack' },
  { sev: 'info', src: 'ENVMON', rule: 'Coordinate map updated', sub: '14 new SAP locations',         site: 'Beloit',      own: '—',         age: '3h',  st: 'closed' },
  { sev: 'warn', src: 'TRACE',  rule: 'CoA missing',           sub: 'Vendor Lactosan / DK',          site: 'Listowel',    own: 'K. Ahern',  age: '5h',  st: 'open' },
  { sev: 'info', src: 'SPC',    rule: 'Cpk recomputed',        sub: 'All chars · 12-week roll',      site: 'All',         own: 'auto',      age: '1d',  st: 'closed' },
  { sev: 'bad',  src: 'ENVMON', rule: 'Salmonella positive',   sub: 'F1 · raw intake L17',           site: 'Rochester',   own: 'M. Wei',    age: '1d',  st: 'ack' },
]

const srcColor = (src: string) =>
  src === 'TRACE' ? '#005776' : src === 'ENVMON' ? '#289BA2' : '#F24A00'

/** Cross-module alarm signal inbox. */
export function Alarms() {
  return (
    <div className="cq-page">
      <PageHead
        eyebrow="MODULE 05"
        title="ALARMS"
        desc="Cross-module signal inbox. Severity, source, rule, subject, site, owner. Acknowledged signals stay visible until closed."
        actions={
          <>
            <button className="cq-btn"><Icon name="dl" size={12} /> Export CSV</button>
            <button className="cq-btn primary"><Icon name="check" size={12} /> Mark all read</button>
          </>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <KPI label="Open" value="6" tone="bad" />
        <KPI label="Acknowledged" value="3" tone="warn" />
        <KPI label="Closed · 24h" value="2" tone="good" />
        <KPI label="MTTR · 30d" value="42" unit="min" />
        <KPI label="False positive rate" value="3.2" unit="%" sub="rolling 90D" />
      </div>
      <Card title="Signal stream" meta="11 EVENTS · LAST 24H" bodyClass="tight">
        <table className="cq-tbl">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Source</th><th>Rule</th><th>Subject</th><th>Site</th>
              <th>Owner</th><th>Age</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} className={r.sev === 'bad' ? 'flagged' : ''}>
                <td>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: r.sev === 'bad' ? 'var(--cq-bad)' : r.sev === 'warn' ? 'var(--cq-warn)' : 'var(--cq-info)' }} />
                </td>
                <td className="mono" style={{ color: srcColor(r.src) }}>{r.src}</td>
                <td>{r.rule}</td>
                <td className="muted">{r.sub}</td>
                <td className="mono">{r.site}</td>
                <td className="mono muted">{r.own}</td>
                <td className="num mono">{r.age}</td>
                <td>
                  <Pill kind={r.st === 'open' ? 'bad' : r.st === 'ack' ? 'warn' : 'muted'}>
                    {r.st}
                  </Pill>
                </td>
                <td><button className="cq-btn sm ghost"><Icon name="arrow" size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
