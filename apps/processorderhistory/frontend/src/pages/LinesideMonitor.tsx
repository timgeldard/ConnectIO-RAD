import { useEffect, useState } from 'react'
import { Icon, KPI, TopBar } from '@connectio/shared-ui'
import { fetchLinesideMonitor, type LinesideMonitorSummary } from '../api/lineside_monitor'

const fmtTime = (ms?: number) => ms ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

export function LinesideMonitorPage() {
  const params = new URLSearchParams(window.location.search)
  const plantId = params.get('plant_id') ?? params.get('plant')
  const [data, setData] = useState<LinesideMonitorSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLinesideMonitor({ plant_id: plantId })
      .then((summary) => { if (!cancelled) { setData(summary); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(String(err)); setLoading(false) } })
    return () => { cancelled = true }
  }, [plantId])

  if (loading) {
    return <div className="app-shell-full"><TopBar breadcrumbs={[{ label: 'Operations' }, { label: 'Lineside Monitor' }]} /><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading live lineside data...</div></div>
  }

  if (error || !data) {
    return <div className="app-shell-full"><TopBar breadcrumbs={[{ label: 'Operations' }, { label: 'Lineside Monitor' }]} /><div style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)' }}>{error || 'No live lineside data available.'}</div></div>
  }

  return (
    <div className="app-shell-full" style={{ minHeight: '100vh', background: 'var(--surface-sunken)' }}>
      <TopBar breadcrumbs={[{ label: 'Operations' }, { label: 'Lineside Monitor' }]} />
      <main style={{ padding: 28, display: 'grid', gap: 18 }}>
        <section style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Live production floor wallboard</div>
            <h1 style={{ margin: '4px 0', fontSize: 30, color: 'var(--text-1)' }}>Lineside Monitor</h1>
            <p style={{ margin: 0, color: 'var(--text-3)' }}>Active orders, downtime, next work, and line-side stock from POH and Warehouse360 views.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-ok)', fontWeight: 700 }}>
            <Icon name="activity" size={16} /> LIVE
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 12 }}>
          <KPI label="Lines active" value={data.kpis.lines_active} icon="activity" tone="ok" />
          <KPI label="Orders running" value={data.kpis.orders_running} icon="layers" />
          <KPI label="Blocked" value={data.kpis.blocked} icon="alert-triangle" tone={data.kpis.blocked ? 'risk' : 'neutral'} />
          <KPI label="Awaiting picks" value={data.kpis.awaiting_picks} icon="package" />
          <KPI label="Line-side SKUs" value={data.kpis.lineside_materials} icon="database" />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {data.lines.map((line) => (
              <article key={line.line_id} style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderLeft: `5px solid ${line.status === 'blocked' ? 'var(--status-risk)' : line.status === 'running' ? 'var(--status-ok)' : 'var(--line-2)'}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{line.line_id}</div>
                    <h2 style={{ margin: '2px 0 0', fontSize: 19 }}>{line.current_order?.material_name ?? 'No active order'}</h2>
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{line.current_order?.process_order_id ?? 'Idle'} · started {fmtTime(line.current_order?.start_ms)}</div>
                  </div>
                  <strong style={{ textTransform: 'uppercase', color: line.status === 'blocked' ? 'var(--status-risk)' : line.status === 'running' ? 'var(--status-ok)' : 'var(--text-3)' }}>{line.status}</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Next orders</div>
                    {line.next_orders.length ? line.next_orders.map((order) => <div key={order.process_order_id} style={{ fontSize: 13 }}>{order.process_order_id} · {order.material_name ?? order.material_id}</div>) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No queued orders</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Downtime</div>
                    {line.downtime.length ? line.downtime.map((dt, i) => <div key={i} style={{ fontSize: 13, color: 'var(--status-risk)' }}>{dt.reason_code ?? 'DT'} · {dt.issue_title ?? 'Downtime'} · {Math.round((dt.duration_s ?? 0) / 60)}m</div>) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No current downtime</div>}
                  </div>
                </div>
              </article>
            ))}
            {!data.lines.length && <div style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 24, color: 'var(--text-3)' }}>No active lines in the live data for this selection.</div>}
          </div>

          <aside style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 16 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Line-side stock</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.lineside_stock.slice(0, 18).map((stock, i) => (
                <div key={`${stock.bin_id}-${stock.material_id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderBottom: '1px solid var(--line-1)', paddingBottom: 7 }}>
                  <span>{stock.bin_id}<br /><span style={{ color: 'var(--text-3)' }}>{stock.material_name ?? stock.material_id ?? '—'}</span></span>
                  <strong>{Math.round(Number(stock.available ?? 0)).toLocaleString()} {stock.uom ?? ''}</strong>
                </div>
              ))}
              {!data.lineside_stock.length && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No line-side stock rows available.</div>}
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
