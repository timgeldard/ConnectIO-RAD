import { Card } from '~/components/Card'
import { Pill } from '~/components/Pill'
import { Icon } from '~/components/Icon'

interface HomeProps {
  onOpen: (id: string) => void
}

const CARDS = [
  {
    id: 'trace', cls: 'mod-trace', num: 'MODULE 01', name: 'TRACE',
    tag: 'Batch traceability · 11 pages',
    desc: 'Forward + reverse trace, mass balance, recall readiness, supplier risk and CoA across every batch in the gold layer.',
    stats: [
      { v: '1,284', lbl: 'Active batches' },
      { v: '3', lbl: 'Recall flags', tone: 'bad' as const },
      { v: '99.2%', lbl: 'Trace coverage', tone: 'good' as const },
    ],
  },
  {
    id: 'envmon', cls: 'mod-envmon', num: 'MODULE 02', name: 'ENVMON',
    tag: 'Environmental monitoring · 4 views',
    desc: 'Spatial heatmaps and time-lapse for MIC inspections, with SPC-driven early warnings and blast-radius vector swabbing.',
    stats: [
      { v: '47', lbl: 'Sites' },
      { v: '12', lbl: 'Warnings', tone: 'warn' as const },
      { v: '2', lbl: 'Open fails', tone: 'bad' as const },
    ],
  },
  {
    id: 'spc', cls: 'mod-spc', num: 'MODULE 03', name: 'SPC',
    tag: 'Statistical process control · 5 views',
    desc: 'I-MR, X̄-R, EWMA, CUSUM, P-charts and Hotelling T². Capability indices with confidence intervals, WECO + Nelson rule detection.',
    stats: [
      { v: '318', lbl: 'Charts live' },
      { v: '5', lbl: 'OOC signals', tone: 'warn' as const },
      { v: '1.41', lbl: 'Avg Cpk', tone: 'good' as const },
    ],
  },
]

const INBOX = [
  { src: 'TRACE', mod: 'trace', ttl: 'Recall simulation requested · MAT 20582002 / 0008898869', meta: 'QA · Charleville', sev: 'bad', when: '2 min' },
  { src: 'ENVMON', mod: 'envmon', ttl: 'Listeria warning trend · Floor 2 / RTE-3 zone, 3 rising swabs', meta: 'Sanitation · Listowel', sev: 'warn', when: '14 min' },
  { src: 'SPC', mod: 'spc', ttl: 'Hotelling T² breach · Spray dryer outlet temp + moisture', meta: 'Process eng · Carrigaline', sev: 'bad', when: '32 min' },
  { src: 'TRACE', mod: 'trace', ttl: 'Mass balance variance > 0.5 kg · BAT 0008898870', meta: 'QA · Charleville', sev: 'warn', when: '1 hr' },
  { src: 'SPC', mod: 'spc', ttl: 'WECO Rule 4 (8 in trend) · X-Bar viscosity, line 4', meta: 'Process eng · Hamburg', sev: 'warn', when: '1 hr' },
  { src: 'ENVMON', mod: 'envmon', ttl: 'Coordinate map updated · 14 new SAP locations', meta: 'Admin · Beloit', sev: 'info', when: '3 hr' },
]

const PLANT_HEALTH = [
  { n: 'Charleville', s: 'good', v: '98.4%', c: 0 },
  { n: 'Listowel', s: 'warn', v: '94.1%', c: 4 },
  { n: 'Carrigaline', s: 'bad', v: '88.7%', c: 6 },
  { n: 'Hamburg', s: 'good', v: '97.0%', c: 1 },
  { n: 'Beloit', s: 'good', v: '99.1%', c: 0 },
  { n: 'Rochester', s: 'warn', v: '93.8%', c: 3 },
]

const PINNED = [
  { mod: 'trace', txt: 'Recall · 0008898869', sub: 'QI · Charleville · WPC-80', icon: 'flag' as const },
  { mod: 'spc', txt: 'Hotelling T² · Spray dryer', sub: 'Limit 0.99 · breaching', icon: 'spc' as const },
  { mod: 'envmon', txt: 'Floor 2 · RTE-3 heatmap', sub: 'Listeria · 90D', icon: 'map' as const },
  { mod: 'trace', txt: 'Bottom-up · WPC-80 lineage', sub: 'Depth 4 · 12 ancestors', icon: 'trace' as const },
]

/** Home launcher — module cards, cross-module inbox, plant health, pinned views. */
export function Home({ onOpen }: HomeProps) {
  const ts = new Date().toLocaleString('en-GB', { hour12: false })

  return (
    <div className="cq-launcher">
      <div className="greet-row">
        <div className="greet">
          GOOD AFTERNOON, SARAH.
          <span className="sub">Three quality systems. One operating picture. Lead with impact.</span>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cq-fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <div>Operating console · UAT</div>
          <div style={{ marginTop: 4, color: 'var(--cq-fg-2)' }}>{ts}</div>
        </div>
      </div>

      <div className="cq-mod-grid">
        {CARDS.map((c) => (
          <button key={c.id} className={'cq-mod-card ' + c.cls} onClick={() => onOpen(c.id)}>
            <span className="mod-bar" style={{ background: 'var(--mod-color)' }} />
            <div className="mod-num">{c.num} <span style={{ float: 'right' }}>↗</span></div>
            <div className="mod-name">{c.name}</div>
            <div className="mod-tag">{c.tag}</div>
            <div className="mod-desc">{c.desc}</div>
            <div className="mod-stats">
              {c.stats.map((s, i) => (
                <div key={i} className="mod-stat">
                  <div className={'v ' + (s.tone ?? '')}>{s.v}</div>
                  <div className="lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="cq-strip">
        <Card
          title="Cross-module inbox" num="04" meta="LAST 24H · 11 EVENTS"
          action={<button className="cq-btn sm ghost"><Icon name="arrow" size={12} /> Open all</button>}
          bodyClass="tight"
        >
          {INBOX.map((row, i) => (
            <div key={i} className={'cq-inbox-row mod-' + row.mod + (i < 2 ? ' unread' : '')}>
              <span style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: row.sev === 'bad' ? 'var(--cq-bad)' : row.sev === 'warn' ? 'var(--cq-warn)' : 'var(--cq-info)' }} />
              <span className="src">{row.src}</span>
              <span className="ttl">{row.ttl} <span className="meta">· {row.meta}</span></span>
              <span>
                <Pill kind={row.sev === 'bad' ? 'bad' : row.sev === 'warn' ? 'warn' : 'info'}>
                  {row.sev === 'bad' ? 'Critical' : row.sev === 'warn' ? 'Warning' : 'Info'}
                </Pill>
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--cq-fg-2)' }}>investigate</span>
              <span className="when">{row.when} ago</span>
            </div>
          ))}
        </Card>

        <Card title="Plant health" num="HOME" meta="47 SITES">
          <div style={{ display: 'grid', gap: 6 }}>
            {PLANT_HEALTH.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto auto', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: i < 5 ? '1px solid var(--cq-line)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: r.s === 'good' ? 'var(--cq-good)' : r.s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-bad)' }} />
                <span style={{ fontSize: 12 }}>{r.n}</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--cq-fg-2)' }}>{r.v}</span>
                <span style={{ width: 22, textAlign: 'right' }} className="mono">
                  {r.c > 0
                    ? <span style={{ color: 'var(--cq-bad)' }}>●{r.c}</span>
                    : <span style={{ color: 'var(--cq-fg-3)' }}>—</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Pinned views" num="PIN" meta="QUICK ACCESS">
          <div style={{ display: 'grid', gap: 8 }}>
            {PINNED.map((p, i) => (
              <button key={i} className={'mod-' + p.mod} style={{
                display: 'grid', gridTemplateColumns: '26px 1fr 14px', gap: 10, alignItems: 'center',
                padding: '8px 10px', border: '1px solid var(--cq-line)', borderLeft: '3px solid var(--mod-color)',
                background: 'var(--cq-surface)', textAlign: 'left', borderRadius: 2,
              }}>
                <span style={{ color: 'var(--mod-color)' }}><Icon name={p.icon} size={16} /></span>
                <span>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--cq-fg)' }}>{p.txt}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--cq-fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginTop: 2 }}>{p.sub}</div>
                </span>
                <Icon name="arrow" size={12} />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
