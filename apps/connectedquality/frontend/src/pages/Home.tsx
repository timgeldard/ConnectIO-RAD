import { useQuery } from '@tanstack/react-query'
import { Card } from '~/components/Card'
import { Pill } from '~/components/Pill'
import { Icon } from '~/components/Icon'
import { fetchJson } from '@connectio/shared-frontend-api'

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

/** Home launcher — module cards, cross-module inbox, plant health, pinned views. */
export function Home({ onOpen }: HomeProps) {
  const ts = new Date().toLocaleString('en-GB', { hour12: false })

  const { data: me } = useQuery({
    queryKey: ['cq', 'me'],
    queryFn: () => fetchJson<{ name: string; initials: string }>('/api/cq/me'),
  })

  const { data: alarmsData } = useQuery({
    queryKey: ['cq', 'alarms'],
    queryFn: () => fetchJson<{ total: number; open: number; alarms: any[] }>('/api/cq/alarms'),
  })

  const { data: plantsData } = useQuery({
    queryKey: ['cq', 'plants'],
    queryFn: () => fetchJson<{ plants: any[] }>('/api/cq/envmon/plants'),
  })

  const displayName = me?.name ? me.name.toUpperCase() : 'USER'
  const inbox = alarmsData?.alarms || []
  const plantHealth = plantsData?.plants || []

  // Dynamic stats calculation for cards
  const cardsDynamic = CARDS.map(card => {
    if (card.id === 'envmon' && plantsData?.plants) {
      const activeFails = plantsData.plants.filter((p: any) => p.status === 'bad').length
      const warnings = plantsData.plants.reduce((acc: number, p: any) => acc + (p.warnings || 0), 0)
      return {
        ...card,
        stats: [
          { v: String(plantsData.plants.length), lbl: 'Sites' },
          { v: String(warnings), lbl: 'Warnings', tone: 'warn' as const },
          { v: String(activeFails), lbl: 'Open fails', tone: 'bad' as const },
        ]
      }
    }
    if (card.id === 'spc' && alarmsData?.alarms) {
      const spcAlarms = alarmsData.alarms.filter((a: any) => a.source === 'spc').length
      return {
        ...card,
        stats: [
          { v: '318', lbl: 'Charts live' },
          { v: String(spcAlarms), lbl: 'OOC signals', tone: 'warn' as const },
          { v: '1.41', lbl: 'Avg Cpk', tone: 'good' as const },
        ]
      }
    }
    return card
  })

  return (
    <div className="cq-launcher">
      <div className="greet-row">
        <div className="greet">
          GOOD AFTERNOON, {displayName}.
          <span className="sub">Three quality systems. One operating picture. Lead with impact.</span>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cq-fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <div>Operating console · UAT</div>
          <div style={{ marginTop: 4, color: 'var(--cq-fg-2)' }}>{ts}</div>
        </div>
      </div>

      <div className="cq-mod-grid">
        {cardsDynamic.map((c) => (
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
          title="Cross-module inbox" num="04" meta={`LAST 24H · ${inbox.length} EVENTS`}
          action={<button className="cq-btn sm ghost"><Icon name="arrow" size={12} /> Open all</button>}
          bodyClass="tight"
        >
          {inbox.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--cq-fg-3)', fontSize: 12 }}>No recent events.</div>
          ) : inbox.map((row: any, i: number) => (
            <div key={i} className={'cq-inbox-row mod-' + row.source + (i < 2 ? ' unread' : '')}>
              <span style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: row.severity === 'bad' ? 'var(--cq-bad)' : row.severity === 'warn' ? 'var(--cq-warn)' : 'var(--cq-info)' }} />
              <span className="src">{String(row.source).toUpperCase()}</span>
              <span className="ttl">{row.title}</span>
              <span>
                <Pill kind={row.severity === 'bad' ? 'bad' : row.severity === 'warn' ? 'warn' : 'info'}>
                  {row.severity === 'bad' ? 'Critical' : row.severity === 'warn' ? 'Warning' : 'Info'}
                </Pill>
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--cq-fg-2)' }}>investigate</span>
              <span className="when">just now</span>
            </div>
          ))}
        </Card>

        <Card title="Plant health" num="HOME" meta={`${plantHealth.length} SITES`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {plantHealth.length === 0 ? (
              <div style={{ padding: '4px 0', color: 'var(--cq-fg-3)', fontSize: 12 }}>Loading sites...</div>
            ) : plantHealth.map((r: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto auto', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: i < 5 ? '1px solid var(--cq-line)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: r.status === 'good' ? 'var(--cq-good)' : r.status === 'warn' ? 'var(--cq-warn)' : 'var(--cq-bad)' }} />
                <span style={{ fontSize: 12 }}>{r.name}</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--cq-fg-2)' }}>{r.status === 'good' ? '100%' : '90%'}</span>
                <span style={{ width: 22, textAlign: 'right' }} className="mono">
                  {r.warnings > 0
                    ? <span style={{ color: 'var(--cq-bad)' }}>●{r.warnings}</span>
                    : <span style={{ color: 'var(--cq-fg-3)' }}>—</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Module routes" num="LINK" meta="LIVE NAV">
          <div style={{ display: 'grid', gap: 8 }}>
            {CARDS.map((card) => (
              <button key={card.id} className={'mod-' + card.id} onClick={() => onOpen(card.id)} style={{
                display: 'grid', gridTemplateColumns: '26px 1fr 14px', gap: 10, alignItems: 'center',
                padding: '8px 10px', border: '1px solid var(--cq-line)', borderLeft: '3px solid var(--mod-color)',
                background: 'var(--cq-surface)', textAlign: 'left', borderRadius: 2,
              }}>
                <span style={{ color: 'var(--mod-color)' }}><Icon name={card.id === 'envmon' ? 'map' : card.id === 'spc' ? 'spc' : 'trace'} size={16} /></span>
                <span>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--cq-fg)' }}>{card.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--cq-fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginTop: 2 }}>{card.tag}</div>
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
