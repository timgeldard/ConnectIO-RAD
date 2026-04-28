// @ts-nocheck
import { cloneElement, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useT } from '../i18n/context'
import { I, fmt, TopBar, StatusBadge, Check, Sparkline } from '../ui'
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

export function OrderList({ onOpen, lineFilter = 'ALL', setLineFilter = () => {} }: OrderListProps) {
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
  const [poursToday, setPoursToday] = useState<number | null>(null)

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
  const sortIcon = (key: SortKey) => sortBy.key !== key ? I.chevD : (sortBy.dir === 'asc' ? I.chevU : I.chevD)

  const allSel = pageOrders.length > 0 && pageOrders.every(o => selected.has(o.id))
  const someSel = pageOrders.some(o => selected.has(o.id)) && !allSel

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const totalRunning = filtered.filter(o => o.status === 'running').length
  const onHold = filtered.filter(o => o.status === 'onhold').length
  const ordersThisMonth = orders.filter(o => o.start != null && o.start >= thirtyDaysAgo).length
  const posStartedToday = filtered.filter(o => isToday(o.start)).length
  const posCompletedToday = filtered.filter(o => o.status === 'completed' && isToday(o.end)).length
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
      <>
        <TopBar trail={[t.operations, t.crumbManufacturing, t.crumbOrders]} />
        <div style={{ padding: '48px 32px', color: 'var(--sunset)' }}>
          {I.alert}<span style={{ marginLeft: 8 }}>Failed to load orders: {fetchError}</span>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar trail={[t.operations, t.crumbManufacturing, t.crumbOrders]} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.hexagon}<span>{t.pageEyebrow}</span></div>
          <h1 className="page-title">{t.pageTitle}</h1>
          <p className="page-sub">{t.pageSub}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn secondary">{I.printer}<span>{t.actionExport}</span></button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t.kpiActive}</div>
          <div className="kpi-value">
            {loading ? '—' : totalRunning}
            <span className="kpi-delta neutral">{t.kpiActiveSub}</span>
          </div>
          <Sparkline data={[2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 5, 4]} color="var(--sage)" />
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiOrders30}</div>
          <div className="kpi-value">
            {loading ? '—' : ordersThisMonth}
            <span className="kpi-delta up">—</span>
          </div>
          <Sparkline data={[12, 18, 15, 22, 19, 24, 28, 25, 30, 27, 29, 33]} color="var(--valentia-slate)" />
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiYield}</div>
          <div className="kpi-value">
            {loading ? '—' : (avgYield ?? '—')}
            {avgYield != null && <span className="kpi-delta up">{t.kpiYieldDelta}</span>}
          </div>
          <Sparkline data={[94.1, 94.8, 95.2, 94.5, 95.5, 95.1, 95.8, 96.0, 95.4, 95.9, 96.2, 96.1]} color="#1F6E4A" />
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiHold}</div>
          <div className="kpi-value">
            {loading ? '—' : onHold}
            <span className="kpi-delta down">{t.kpiHoldSub}</span>
          </div>
          <Sparkline data={[3, 2, 4, 2, 3, 1, 2, 3, 4, 5, 3, 2]} color="var(--sunset)" />
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiPOsStarted}</div>
          <div className="kpi-value">{loading ? '—' : posStartedToday}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiPOsCompleted}</div>
          <div className="kpi-value">{loading ? '—' : posCompletedToday}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.kpiPoursToday}</div>
          <div className="kpi-value">{poursToday ?? '—'}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          {I.search}
          <input placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
          <kbd>⌘K</kbd>
        </div>

        <div className="toolbar-divider" />

        <span className="chip-label">{t.statusLabel}</span>
        {(STATUSES as any[]).slice(0, 5).map(s => (
          <button
            key={s.key}
            className={`chip ${statusFilter.has(s.key) ? 'active' : ''}`}
            onClick={() => toggleStatus(s.key)}
          >
            <span className={`dot status-${s.key}`} />
            <span>{statusLabel[s.key]}</span>
          </button>
        ))}

        <div className="toolbar-divider" />

        <div className="date-pick">
          {I.calendar}
          <input
            type="date"
            value={dateFrom}
            max={dateTo || _today}
            onChange={e => setDateFrom(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, cursor: 'pointer' }}
          />
          <span className="sep">→</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={_today}
            onChange={e => setDateTo(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, cursor: 'pointer' }}
          />
        </div>

        <select
          className="chip"
          value={productFilter || ''}
          onChange={e => setProductFilter(e.target.value || null)}
          style={{ cursor: 'pointer' }}
        >
          <option value="">{t.productLabel} · {t.productAll}</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        <div className="toolbar-spacer" />

        <button className="btn ghost sm">{I.refresh}<span>{t.refresh}</span></button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="count-pill">{selected.size}</span>
          <span>{selected.size === 1 ? t.bulkOrderSing : t.bulkOrderPlural}</span>
          <div className="b-spacer" />
          <button>{I.download}<span>{t.bulkExport}</span></button>
          <button>{I.copy}<span>{t.bulkCompare}</span></button>
          <button>{I.archive}<span>{t.bulkArchive}</span></button>
          <button>{I.pause}<span>{t.bulkHold}</span></button>
          <button className="clear" onClick={() => setSelected(new Set())}>{I.x}<span>{t.bulkClear}</span></button>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-meta">
          <strong>{loading ? '…' : filtered.length.toLocaleString()}</strong>
          <span>{t.ordersMatch}</span>
          {(statusFilter.size > 0 || search) && (
            <button className="btn ghost sm" onClick={() => { setStatusFilter(new Set()); setSearch('') }}>
              {I.x}<span>{t.clearFilters}</span>
            </button>
          )}
          <div className="tm-spacer" />
          <span>
            {t.sortedBy} <strong>{(t as any)[`sortKey_${sortBy.key}`] || sortBy.key}</strong> ·{' '}
            {sortBy.dir === 'asc' ? t.sortAsc : t.sortDesc}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
            Loading orders…
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="col-check">
                  <Check checked={allSel} indeterminate={someSel} onClick={toggleSelectAllOnPage} />
                </th>
                <th className={`col-id ${sortBy.key === 'id' ? 'sorted' : ''}`}>
                  <span className="sortable" onClick={() => onSort('id')}>{t.colOrderLot} {sortIcon('id')}</span>
                </th>
                <th className={sortBy.key === 'product' ? 'sorted' : ''}>
                  <span className="sortable" onClick={() => onSort('product')}>{t.colProduct} {sortIcon('product')}</span>
                </th>
                <th className={`col-status ${sortBy.key === 'status' ? 'sorted' : ''}`}>{t.colStatus}</th>
                <th className={sortBy.key === 'line' ? 'sorted' : ''}>
                  <span className="sortable" onClick={() => onSort('line')}>{t.colLine} {sortIcon('line')}</span>
                </th>
                <th className={`col-qty ${sortBy.key === 'qty' ? 'sorted' : ''}`}>
                  <span className="sortable" onClick={() => onSort('qty')}>{t.colQty} {sortIcon('qty')}</span>
                </th>
                <th className={`col-yield ${sortBy.key === 'yield' ? 'sorted' : ''}`}>
                  <span className="sortable" onClick={() => onSort('yield')}>{t.colYield} {sortIcon('yield')}</span>
                </th>
                <th className={`col-date ${sortBy.key === 'start' ? 'sorted' : ''}`}>
                  <span className="sortable" onClick={() => onSort('start')}>{t.colStarted} {sortIcon('start')}</span>
                </th>
                <th className="col-end"></th>
              </tr>
            </thead>
            <tbody>
              {pageOrders.map(o => {
                const isSel = selected.has(o.id)
                const yieldClass = o.yieldPct == null ? 'ok' : o.yieldPct >= 95 ? 'good' : o.yieldPct >= 90 ? 'ok' : 'bad'
                return (
                  <tr key={o.id} className={isSel ? 'selected' : ''} onClick={() => onOpen(o)}>
                    <td className="col-check">
                      <Check checked={isSel} onClick={() => toggleSelect(o.id)} />
                    </td>
                    <td className="col-id">
                      <div className="cell-id">{o.id}<span className="lot">{o.lot ?? '—'}</span></div>
                    </td>
                    <td>
                      <div className="cell-product">
                        {o.product.name}
                        <span className="sku">{o.product.sku} · {o.product.category}</span>
                      </div>
                    </td>
                    <td className="col-status">
                      <StatusBadge status={o.status} onClick={(s) => toggleStatus(s)} />
                    </td>
                    <td>
                      <div className="cell-product">
                        {o.line ?? '—'}
                        <span className="sku">{o.shift ? `${t.shift} ${o.shift}` : '—'}{o.operator ? ` · ${o.operator}` : ''}</span>
                      </div>
                    </td>
                    <td className="col-qty">
                      <div className="cell-num">
                        {o.actualQty != null ? fmt.num(o.actualQty) : '—'}<span className="unit">kg</span>
                        {o.targetQty != null && (
                          <div style={{ color: 'var(--ink-400)', fontSize: 11, marginTop: 2 }}>{t.of} {fmt.num(o.targetQty)}</div>
                        )}
                      </div>
                    </td>
                    <td className="col-yield">
                      {o.yieldPct == null ? (
                        <div className="cell-num" style={{ color: 'var(--ink-400)' }}>—</div>
                      ) : (
                        <div className="yield-bar">
                          <div className="bar"><div className={`fill ${yieldClass}`} style={{ width: `${Math.min(100, o.yieldPct)}%` }} /></div>
                          <span className="pct">{o.yieldPct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="col-date">
                      <div className="cell-date">
                        {o.start != null ? `${fmt.shortDate(o.start)}, ${fmt.time(o.start)}` : '—'}
                        <span className="time">
                          {o.durationH != null ? fmt.duration(o.durationH) : ''}
                          {o.status === 'running' ? ` · ${t.runningSuffix}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="col-end">{cloneElement(I.chevR as ReactElement, { className: 'row-go' })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && (
          <div className="pagination">
            <span>
              {t.showing}{' '}
              <strong style={{ color: 'var(--forest)', fontWeight: 600 }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
              </strong>{' '}
              {t.of}{' '}
              <strong style={{ color: 'var(--forest)', fontWeight: 600 }}>{filtered.length}</strong>
            </span>
            <div className="pager-spacer" />
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{I.chevL}</button>
            <div className="pages">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const n = i + 1
                return (
                  <button key={n} className={`page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                )
              })}
              {totalPages > 5 && <span style={{ padding: '0 4px', color: 'var(--ink-400)' }}>…</span>}
            </div>
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{I.chevR}</button>
          </div>
        )}
      </div>
    </>
  )
}
