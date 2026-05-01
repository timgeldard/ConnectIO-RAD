import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { KPI, Icon, TopBar, Button } from '@connectio/shared-ui'
import { fmt, StatusBadge, Check } from '../ui'
import { STATUSES } from '../data/mock'
import { fetchOrders } from '../api/orders'
import type { Order } from '../api/orders'
import { fetchPoursAnalytics } from '../api/pours'

function isToday(ms: number | null): boolean {
  if (ms == null) return false
  const d = new Date(ms)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

type SortKey = 'id' | 'product' | 'qty' | 'yield' | 'line' | 'start' | 'status'

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const _today = toISODate(new Date())
const _sevenAgo = toISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

interface OrderListProps {
  onOpen: (order: any) => void
  lineFilter?: string
  setLineFilter?: (value: string) => void
}

export function OrderList({ onOpen, lineFilter = 'ALL' }: OrderListProps) {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(_sevenAgo)
  const [dateTo, setDateTo] = useState(_today)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'start', dir: 'desc' })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 14

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [_poursToday, setPoursToday] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetchOrders({ limit: 2000 })
      .then(res => { if (!cancelled) { setOrders(res.orders); setLoading(false) } })
      .catch(err => { if (!cancelled) { setFetchError(String(err?.message ?? err)); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetchPoursAnalytics({ dateFrom: _today, dateTo: _today })
      .then(data => setPoursToday(data.events.length))
      .catch(() => {})
  }, [])

  const categories = useMemo(
    () => [...new Set(orders.map(o => o.product.category).filter(Boolean))].sort() as string[],
    [orders],
  )

  const filtered = useMemo(() => {
    let list = orders
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.lot ?? '').toLowerCase().includes(q) ||
        o.product.name.toLowerCase().includes(q) ||
        o.product.sku.toLowerCase().includes(q),
      )
    }
    if (statusFilter.size > 0) list = list.filter(o => statusFilter.has(o.status))
    if (productFilter) list = list.filter(o => o.product.category === productFilter)
    if (lineFilter && lineFilter !== 'ALL') list = list.filter(o => o.line === lineFilter)
    if (dateFrom) {
      const fromMs = new Date(dateFrom).getTime()
      list = list.filter(o => o.start == null || o.start >= fromMs)
    }
    if (dateTo) {
      const toMs = new Date(dateTo).getTime() + 86_400_000  // inclusive end of day
      list = list.filter(o => o.start == null || o.start < toMs)
    }
    const sorted = [...list].sort((a, b) => {
      let av: any, bv: any
      switch (sortBy.key) {
        case 'id': av = a.id; bv = b.id; break
        case 'product': av = a.product.name; bv = b.product.name; break
        case 'qty': av = a.actualQty ?? -1; bv = b.actualQty ?? -1; break
        case 'yield': av = a.yieldPct ?? -1; bv = b.yieldPct ?? -1; break
        case 'line': av = a.line ?? ''; bv = b.line ?? ''; break
        case 'start':
        default: av = a.start ?? 0; bv = b.start ?? 0
      }
      if (av < bv) return sortBy.dir === 'asc' ? -1 : 1
      if (av > bv) return sortBy.dir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [orders, search, statusFilter, productFilter, dateFrom, dateTo, sortBy, lineFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter, productFilter, dateFrom, dateTo, lineFilter])

  const toggleStatus = (s: string) => {
    setStatusFilter(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n })
  }
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleSelectAllOnPage = () => {
    const allSelected = pageOrders.every(o => selected.has(o.id))
    setSelected(prev => {
      const n = new Set(prev)
      if (allSelected) pageOrders.forEach(o => n.delete(o.id))
      else pageOrders.forEach(o => n.add(o.id))
      return n
    })
  }
  const onSort = (key: SortKey) => {
    setSortBy(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'start' ? 'desc' : 'asc' })
  }
  const sortIcon = (key: SortKey): any => sortBy.key !== key ? 'chevron-down' : (sortBy.dir === 'asc' ? 'chevron-up' : 'chevron-down')

  const allSel = pageOrders.length > 0 && pageOrders.every(o => selected.has(o.id))
  const someSel = pageOrders.some(o => selected.has(o.id)) && !allSel

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const totalRunning = filtered.filter(o => o.status === 'running').length
  const onHold = filtered.filter(o => o.status === 'onhold').length
  const ordersThisMonth = orders.filter(o => o.start != null && o.start >= thirtyDaysAgo).length
  const avgYield = (() => {
    const ys = filtered.filter(o => o.yieldPct != null).map(o => o.yieldPct as number)
    if (ys.length === 0) return null
    return (ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(1)
  })()

  const statusLabel: Record<string, string> = {
    running: t.statusRunning, completed: t.statusCompleted, released: t.statusReleased,
    onhold: t.statusOnhold, cancelled: t.statusCancelled, failed: t.statusFailed,
  }

  if (fetchError) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing }, { label: t.crumbOrders }]} />
        <div style={{ padding: '48px 32px', color: 'var(--status-risk)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-triangle" />
          <span>Failed to load orders: {fetchError}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing }, { label: t.crumbOrders }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="layers" size={14} />
            <span>{t.pageEyebrow}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text-1)' }}>{t.pageTitle}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t.pageSub}</p>
        </div>
        <div className="page-head-actions" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button variant="secondary" icon={<Icon name="printer" />}>{t.actionExport}</Button>
        </div>
      </div>

      <div className="pour-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '0 32px 24px', background: 'var(--surface-0)' }}>
        <KPI
          label={t.kpiActive}
          value={loading ? '—' : totalRunning}
          subtext={t.kpiActiveSub}
          sparkline={[2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 5, 4]}
          tone="neutral"
          icon="activity"
        />
        <KPI
          label={t.kpiOrders30}
          value={loading ? '—' : ordersThisMonth}
          sparkline={[12, 18, 15, 22, 19, 24, 28, 25, 30, 27, 29, 33]}
          tone="neutral"
          icon="layers"
        />
        <KPI
          label={t.kpiYield}
          value={loading ? '—' : (avgYield ?? '—')}
          unit="%"
          subtext={avgYield != null ? t.kpiYieldDelta : undefined}
          sparkline={[94.1, 94.8, 95.2, 94.5, 95.5, 95.1, 95.8, 96.0, 95.4, 95.9, 96.2, 96.1]}
          tone="ok"
          icon="trending-up"
        />
        <KPI
          label={t.kpiHold}
          value={loading ? '—' : onHold}
          subtext={t.kpiHoldSub}
          sparkline={[3, 2, 4, 2, 3, 1, 2, 3, 4, 5, 3, 2]}
          tone="risk"
          icon="alert-triangle"
        />
      </div>

      <div className="toolbar" style={{ padding: '12px 32px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="search-box" style={{ position: 'relative', width: 300 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input 
            placeholder={t.searchPlaceholder} 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ width: '100%', padding: '6px 12px 6px 32px', fontSize: 13, border: '1px solid var(--line-1)', borderRadius: 6, background: 'var(--surface-0)' }}
          />
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--line-1)' }} />

        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.statusLabel}</span>
        {(STATUSES as any[]).slice(0, 5).map(s => (
          <button
            key={s.key}
            className={`chip ${statusFilter.has(s.key) ? 'active' : ''}`}
            onClick={() => toggleStatus(s.key)}
            style={{ padding: '4px 10px', borderRadius: 99, border: '1px solid var(--line-1)', background: statusFilter.has(s.key) ? 'var(--surface-0)' : 'transparent', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--status-${s.key === 'running' ? 'ok' : s.key === 'completed' ? 'ok' : s.key === 'onhold' ? 'risk' : 'neutral'})` }} />
            <span>{statusLabel[s.key]}</span>
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: 'var(--line-1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <Icon name="calendar" size={14} />
          <input
            type="date"
            value={dateFrom}
            max={dateTo || _today}
            onChange={e => setDateFrom(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', cursor: 'pointer' }}
          />
          <span style={{ opacity: 0.5 }}>→</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={_today}
            onChange={e => setDateTo(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', cursor: 'pointer' }}
          />
        </div>

        <div style={{ flex: 1 }} />

        <Button variant="ghost" onClick={() => window.location.reload()} icon={<Icon name="refresh" />}>{t.refresh}</Button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar" style={{ padding: '8px 32px', background: 'var(--valentia-slate)', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ background: '#fff', color: 'var(--valentia-slate)', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>{selected.size}</span>
          <span style={{ fontWeight: 600 }}>{selected.size === 1 ? t.bulkOrderSing : t.bulkOrderPlural}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }}><Icon name="download" /><span>{t.bulkExport}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }}><Icon name="copy" /><span>{t.bulkCompare}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }}><Icon name="archive" /><span>{t.bulkArchive}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }} onClick={() => setSelected(new Set())}><Icon name="x" /><span>{t.bulkClear}</span></button>
        </div>
      )}

      <div style={{ padding: '0 32px 48px' }}>
        <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          <div>
            <strong style={{ color: 'var(--text-1)' }}>{loading ? '…' : filtered.length.toLocaleString()}</strong> {t.ordersMatch}
          </div>
          {(statusFilter.size > 0 || search) && (
            <Button variant="ghost" onClick={() => { setStatusFilter(new Set()); setSearch('') }} icon={<Icon name="x" />}>{t.clearFilters}</Button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
            Loading orders…
          </div>
        ) : (
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: 40 }}>
                  <Check checked={allSel} indeterminate={someSel} onClick={toggleSelectAllOnPage} />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('id')}>{t.colOrderLot} <Icon name={sortIcon('id')} size={12} /></span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('product')}>{t.colProduct} <Icon name={sortIcon('product')} size={12} /></span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.colStatus}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('line')}>{t.colLine} <Icon name={sortIcon('line')} size={12} /></span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('qty')}>{t.colQty} <Icon name={sortIcon('qty')} size={12} /></span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('yield')}>{t.colYield} <Icon name={sortIcon('yield')} size={12} /></span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => onSort('start')}>{t.colStarted} <Icon name={sortIcon('start')} size={12} /></span>
                </th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageOrders.map(o => {
                const isSel = selected.has(o.id)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line-1)', background: isSel ? 'var(--surface-sunken)' : 'transparent', cursor: 'pointer' }} onClick={() => onOpen(o)}>
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <Check checked={isSel} onClick={() => toggleSelect(o.id)} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{o.id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{o.lot ?? '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{o.product.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.product.sku} · {o.product.category}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={o.status} onClick={(s) => toggleStatus(s)} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{o.line ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.shift ? `${t.shift} ${o.shift}` : '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{o.actualQty != null ? fmt.num(o.actualQty) : '—'}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>kg</span></div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: o.yieldPct && o.yieldPct >= 95 ? 'var(--status-ok)' : o.yieldPct && o.yieldPct >= 90 ? 'var(--status-warn)' : 'var(--status-risk)', fontFamily: 'var(--font-mono)' }}>{o.yieldPct ? `${o.yieldPct}%` : '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{o.start != null ? fmt.shortDate(o.start) : '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.start != null ? fmt.time(o.start) : ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><Icon name="chevron-right" style={{ opacity: 0.3 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {t.showing} <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> {t.of} <strong>{filtered.length}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} icon={<Icon name="chevron-left" />} />
              <Button variant="ghost" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} icon={<Icon name="chevron-right" />} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
