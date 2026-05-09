import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@connectio/shared-frontend-api'
import { Card, KPI, PageHead, Icon, DataTable, type Column } from '@connectio/shared-ui'
import { Pill } from '~/components/Pill'

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

  const columns: Column<any>[] = [
    {
      header: '',
      width: 28,
      render: (r) => {
        const severity = r.severity ?? r.sev ?? 'info'
        return (
          <span style={{ 
            display: 'inline-block', width: 10, height: 10, borderRadius: 999, 
            background: severity === 'bad' || severity === 'critical' ? 'var(--cq-bad)' : severity === 'warn' ? 'var(--cq-warn)' : 'var(--cq-info)' 
          }} />
        )
      }
    },
    {
      header: 'Source',
      render: (r) => {
        const source = String(r.source ?? r.src ?? '').toUpperCase()
        return <span style={{ color: srcColor(source), fontFamily: 'var(--font-mono)' }}>{source || '—'}</span>
      }
    },
    { header: 'Rule', render: (r) => r.rule ?? r.title ?? 'Signal' },
    { header: 'Subject', render: (r) => r.context ?? r.subject ?? '—', muted: true },
    { header: 'Site', render: (r) => r.plant_id ?? r.site ?? '—', mono: true },
    { header: 'Owner', render: (r) => r.owner ?? '—', mono: true, muted: true },
    { header: 'Age', render: (r) => r.age ?? '—', mono: true, num: true },
    {
      header: 'Status',
      render: (r) => {
        const status = r.status ?? r.st ?? 'open'
        return (
          <Pill kind={status === 'open' ? 'bad' : status === 'ack' ? 'warn' : 'muted'}>
            {status}
          </Pill>
        )
      }
    },
    {
      header: '',
      align: 'right',
      render: () => <button className="cq-btn sm ghost"><Icon name="arrow" size={11} /></button>
    }
  ]

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
        <KPI label="Open" value={isLoading ? '…' : String(open)} tone={open > 0 ? 'risk' : 'ok'} />
        <KPI label="Acknowledged" value={isLoading ? '…' : String(ack)} tone={ack > 0 ? 'warn' : 'ok'} />
        <KPI label="Closed · 24h" value={isLoading ? '…' : String(closed)} tone="ok" />
        <KPI label="MTTR · 30d" value="42" unit="min" />
        <KPI label="False positive rate" value="3.2" unit="%" subtext="rolling 90D" />
      </div>
      <Card title="Signal stream" meta={`${rows.length} EVENTS · LAST 24H`} noPad>
        {isError ? (
          <div style={{ padding: 24, color: 'var(--status-risk)' }}>
            Unable to load live alarms: {(error as Error).message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            dense
            rowKey={(r, i) => r.id ?? i}
            emphasize={(r) => {
              const severity = r.severity ?? r.sev ?? 'info'
              return severity === 'bad' || severity === 'critical'
            }}
          />
        )}
      </Card>
    </div>
  )
}
