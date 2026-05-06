import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@connectio/shared-frontend-api'
import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const srcColor = (src: string) =>
  src === 'TRACE' ? '#005776' : src === 'ENVMON' ? '#289BA2' : '#F24A00'

/** Cross-module alarm signal inbox. */
export function Alarms() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cq', 'alarms-page'],
    queryFn: () => fetchJson<{ total: number; open: number; alarms: any[] }>('/api/cq/alarms'),
  })
  const rows = data?.alarms ?? []
  const open = data?.open ?? rows.filter((row: any) => row.status === 'open').length
  const ack = rows.filter((row: any) => row.status === 'ack').length
  const closed = rows.filter((row: any) => row.status === 'closed').length

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
        <KPI label="Open" value={isLoading ? '…' : String(open)} tone={open > 0 ? 'bad' : 'good'} />
        <KPI label="Acknowledged" value={isLoading ? '…' : String(ack)} tone={ack > 0 ? 'warn' : 'good'} />
        <KPI label="Closed · 24h" value={isLoading ? '…' : String(closed)} tone="good" />
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
            {rows.map((r: any, i: number) => {
              const severity = r.severity ?? r.sev ?? 'info'
              const source = String(r.source ?? r.src ?? '').toUpperCase()
              const status = r.status ?? r.st ?? 'open'
              return (
              <tr key={r.id ?? i} className={severity === 'bad' || severity === 'critical' ? 'flagged' : ''}>
                <td>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: severity === 'bad' || severity === 'critical' ? 'var(--cq-bad)' : severity === 'warn' ? 'var(--cq-warn)' : 'var(--cq-info)' }} />
                </td>
                <td className="mono" style={{ color: srcColor(source) }}>{source || '—'}</td>
                <td>{r.rule ?? r.title ?? 'Signal'}</td>
                <td className="muted">{r.context ?? r.subject ?? '—'}</td>
                <td className="mono">{r.plant_id ?? r.site ?? '—'}</td>
                <td className="mono muted">{r.owner ?? '—'}</td>
                <td className="num mono">{r.age ?? '—'}</td>
                <td>
                  <Pill kind={status === 'open' ? 'bad' : status === 'ack' ? 'warn' : 'muted'}>
                    {status}
                  </Pill>
                </td>
                <td><button className="cq-btn sm ghost"><Icon name="arrow" size={11} /></button></td>
              </tr>
            )})}
            {isLoading && <tr><td colSpan={9} className="muted">Loading live alarms…</td></tr>}
            {!isLoading && rows.length === 0 && !isError && <tr><td colSpan={9} className="muted">No live alarms for the active context.</td></tr>}
            {isError && <tr><td colSpan={9} className="muted">Unable to load live alarms: {(error as Error).message}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
