import { useMemo, useState, useEffect } from 'react'
import { useT } from '../i18n/context'
import { KPI, Icon, TopBar, Button, GlobalFilterBar, FilterGroup, FilterDivider, type Column } from '@connectio/shared-ui'
import { usePlantSelection } from '@connectio/shared-app-context'
import { useQuery } from '@tanstack/react-query'
import { fmt, StatusBadge, DataTable } from '../ui'
import { STATUSES } from '../data/mock'
import { fetchOrders } from '../api/orders'
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
const PAGE_SIZE = 50

/**
 * Props for the order list page.
 */
export interface OrderListProps {
  /** Callback invoked when a user opens an order from the table. */
  onOpen: (order: Order) => void
  /** Active production line filter. Defaults to all lines. */
  lineFilter?: string
  /** Optional setter for the active line filter. */
  setLineFilter?: (value: string) => void
}

interface Order {
  id: string
  lot?: string | null
  status: string
  line?: string | null
  shift?: string | null
  actualQty?: number | null
  yieldPct?: number | null
  start?: number | null
  end?: number | null
  product: {
    name: string
    sku: string
    category: string
  }
}

/**
 * Renders the process order history overview with KPIs, filters, and a paged data table.
 *
 * @param props - Page configuration and row-open callback.
 * @returns The process order history list view.
 */
export function OrderList({ onOpen, lineFilter = 'ALL' }: OrderListProps) {
  const { t } = useT()
  const { selectedPlantId } = usePlantSelection()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(_sevenAgo)
  const [dateTo, setDateTo] = useState(_today)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'start', dir: 'desc' })
  const [page, setPage] = useState(1)

  const { data: ordersData, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['poh', 'orders', selectedPlantId],
    queryFn: () => fetchOrders({ plantId: selectedPlantId || undefined, limit: 2000 }),
    staleTime: 30_000,
  })

  const orders = ordersData?.orders ?? []

  const { totalRunning, onHold, avgYield } = useMemo(() => {
    let running = 0
    let hold = 0
    let validYieldCount = 0
    let totalYield = 0

    for (const o of orders) {
      if (o.status === 'running') running++
      if (o.status === 'onhold' || o.status === 'failed') hold++
      if (o.yieldPct != null) {
        validYieldCount++
        totalYield += o.yieldPct
      }
    }

    return {
      totalRunning: running,
      onHold: hold,
      avgYield: validYieldCount === 0 ? null : Math.round(totalYield / validYieldCount)
    }
  }, [orders])
  const ordersThisMonth = orders.length

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      running: t.statusRunning,
      completed: t.statusCompleted,
      closed: t.statusClosed || 'Closed',
      released: t.statusReleased,
      onhold: t.statusOnhold,
      cancelled: t.statusCancelled,
      failed: t.statusFailed,
    }
    return map
  }, [t])

  const { data: poursData } = useQuery({
    queryKey: ['poh', 'pours', 'today'],
    queryFn: () => fetchPoursAnalytics({ dateFrom: _today, dateTo: _today }),
    staleTime: 60_000,
  })

  const poursToday = poursData?.events.length ?? null

  const categories = useMemo(
    () => [...new Set(orders.map(o => o.product.category).filter(Boolean))].sort() as string[],
    [orders],
  )

  const filtered = useMemo(() => {
    const searchTrimmed = search.trim().toLowerCase()
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null
    const toMs = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null

    const list: Order[] = []

    for (const o of orders) {
      if (searchTrimmed) {
        if (!(
          o.id.toLowerCase().includes(searchTrimmed) ||
          (o.lot ?? '').toLowerCase().includes(searchTrimmed) ||
          o.product.name.toLowerCase().includes(searchTrimmed) ||
          o.product.sku.toLowerCase().includes(searchTrimmed)
        )) {
          continue
        }
      }
      if (statusFilter.size > 0 && !statusFilter.has(o.status)) continue
      if (productFilter && o.product.category !== productFilter) continue
      if (lineFilter && lineFilter !== 'ALL' && o.line !== lineFilter) continue

      const refDate = o.end ?? o.start
      if (fromMs && refDate != null && refDate < fromMs) continue
      if (toMs && refDate != null && refDate >= toMs) continue

      list.push(o)
    }

    const sorted = list.sort((a, b) => {
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

  const columns: Column<Order>[] = useMemo(() => [
    {
      header: t.colOrderLot,
      render: (o) => (
        <>
          <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{o.id}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{o.lot ?? '—'}</div>
        </>
      ),
      sortKey: 'id',
    },
    {
      header: t.colProduct,
      render: (o) => (
        <>
          <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{o.product.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.product.sku} · {o.product.category}</div>
        </>
      ),
      sortKey: 'product',
    },
    {
      header: t.colStatus,
      render: (o) => <StatusBadge status={o.status} onClick={(s) => toggleStatus(s)} />,
      sortKey: 'status',
    },
    {
      header: t.colLine,
      render: (o) => (
        <>
          <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{o.line ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.shift ? `${t.shift} ${o.shift}` : '—'}</div>
        </>
      ),
      sortKey: 'line',
    },
    {
      header: t.colQty,
      align: 'right',
      render: (o) => (
        <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
          {o.actualQty != null ? fmt.num(o.actualQty) : '—'}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>kg</span>
        </div>
      ),
      sortKey: 'qty',
    },
    {
      header: t.colYield,
      align: 'right',
      render: (o) => (
        <div style={{ fontWeight: 'var(--fw-semibold)', color: o.yieldPct && o.yieldPct >= 95 ? 'var(--status-ok)' : o.yieldPct && o.yieldPct >= 90 ? 'var(--status-warn)' : 'var(--status-risk)', fontFamily: 'var(--font-mono)' }}>
          {o.yieldPct ? `${o.yieldPct}%` : '—'}
        </div>
      ),
      sortKey: 'yield',
    },
    {
      header: t.colStarted,
      render: (o) => (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{o.start != null ? fmt.shortDate(o.start) : '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.start != null ? fmt.time(o.start) : ''}</div>
        </>
      ),
      sortKey: 'start',
    },
    {
      header: '',
      width: 40,
      render: () => <Icon name="chevron-right" style={{ opacity: 0.3 }} />,
    }
  ], [t, toggleStatus]);

  if (fetchError) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing }, { label: t.crumbOrders }]} />
        <div style={{ padding: '48px 32px', color: 'var(--status-risk)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-triangle" />
          <span>Failed to load orders: {(fetchError as Error).message}</span>
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
          <h1 style={{ fontSize: 28, fontWeight: 'var(--fw-bold)', margin: '8px 0 4px', color: 'var(--text-1)' }}>{t.pageTitle}</h1>
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

      <GlobalFilterBar style={{ background: 'var(--surface-sunken)' }}>
        <div className="search-box" style={{ position: 'relative', width: 300 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input 
            placeholder={t.searchPlaceholder} 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ width: '100%', padding: '6px 12px 6px 32px', fontSize: 13, border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)' }}
          />
        </div>

        <FilterDivider />

        <FilterGroup label={t.statusLabel}>
          {(STATUSES as any[]).map(s => (
            <button
              key={s.key}
              className={`chip ${statusFilter.has(s.key) ? 'active' : ''}`}
              onClick={() => toggleStatus(s.key)}
              style={{ padding: '4px 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-1)', background: statusFilter.has(s.key) ? 'var(--surface-0)' : 'transparent', fontSize: 'var(--fs-12)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span className={`dot status-${s.key}`} style={{ width: 8, height: 8, borderRadius: 99 }} />
              <span>{statusLabel[s.key]}</span>
            </button>
          ))}
        </FilterGroup>

        <FilterDivider />

        <FilterGroup>
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
        </FilterGroup>

        <div style={{ flex: 1 }} />

        <Button variant="ghost" onClick={() => window.location.reload()} icon={<Icon name="refresh" />}>{t.refresh}</Button>
      </GlobalFilterBar>

      {selected.size > 0 && (
        <div className="bulk-bar" style={{ padding: '8px 32px', background: 'var(--valentia-slate)', color: 'var(--fg-on-brand)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ background: 'var(--fg-on-brand)', color: 'var(--valentia-slate)', padding: '2px 8px', borderRadius: 'var(--r-sm)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-12)' }}>{selected.size}</span>
          <span style={{ fontWeight: 'var(--fw-semibold)' }}>{selected.size === 1 ? t.bulkOrderSing : t.bulkOrderPlural}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-on-brand)' }}><Icon name="download" /><span>{t.bulkExport}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-on-brand)' }}><Icon name="copy" /><span>{t.bulkCompare}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-on-brand)' }}><Icon name="archive" /><span>{t.bulkArchive}</span></button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-on-brand)' }} onClick={() => setSelected(new Set())}><Icon name="x" /><span>{t.bulkClear}</span></button>
        </div>
      )}

      <div style={{ padding: '16px 32px 48px' }}>
        <div style={{ padding: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          <div>
            <strong style={{ color: 'var(--text-1)' }}>{loading ? '…' : filtered.length.toLocaleString()}</strong> {t.ordersMatch}
          </div>
          {(statusFilter.size > 0 || search) && (
            <Button variant="ghost" onClick={() => { setStatusFilter(new Set()); setSearch('') }} icon={<Icon name="x" />}>{t.clearFilters}</Button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(o) => o.id}
          loading={loading}
          pagination={{ pageSize: PAGE_SIZE }}
          sortKey={sortBy.key}
          sortDir={sortBy.dir}
          onSort={(key, dir) => setSortBy({ key: key as SortKey, dir })}
          onRowClick={(o) => onOpen(o)}
          selection={{
            selectedIds: selected,
            onToggle: (id) => toggleSelect(String(id)),
            onToggleAll: toggleSelectAllOnPage,
            allSelected: allSel,
            someSelected: someSel,
          }}
        />
      </div>
    </div>
  )
}
