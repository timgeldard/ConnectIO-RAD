import { useQuery } from '@tanstack/react-query'
import { Card } from '@connectio/shared-ui'
import { Pill } from '~/components/Pill'
import { Icon } from '@connectio/shared-ui'
import { fetchJson } from '@connectio/shared-frontend-api'

/**
 * Home launcher for the ConnectedQuality application.
 *
 * Renders the operating console — a tile grid for the CQ-owned modules
 * (Lab, Alarms, Admin), the cross-module inbox feed, plant-health
 * indicators, and the user's pinned views.
 *
 * @returns The CQ home page React element.
 */
export function Home() {
  const ts = new Date().toLocaleString('en-GB', { hour12: false })

  const { data: me } = useQuery({
    queryKey: ['cq', 'me'],
    queryFn: () => fetchJson<{ name: string; initials: string }>('/api/cq/me'),
  })

  const { data: alarmsData } = useQuery({
    queryKey: ['cq', 'alarms'],
    queryFn: () => fetchJson<{ total: number; open: number; alarms: any[] }>('/api/cq/alarms'),
  })

  const displayName = me?.name ? me.name.toUpperCase() : 'USER'
  const inbox = alarmsData?.alarms || []

  return (
    <div className="cq-launcher">
      <div className="greet-row">
        <div className="greet">
          GOOD AFTERNOON, {displayName}.
          <span className="sub">Quality systems. One operating picture. Lead with impact.</span>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cq-fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <div>Operating console · UAT</div>
          <div style={{ marginTop: 4, color: 'var(--cq-fg-2)' }}>{ts}</div>
        </div>
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

      </div>
    </div>
  )
}
