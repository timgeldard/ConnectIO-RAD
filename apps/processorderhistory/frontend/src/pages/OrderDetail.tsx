import { useEffect, useState, useMemo } from 'react'
import { useT } from '../i18n/context'
import {
  TopBar,
  Icon,
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  KPI,
  Button,
  DataTable,
  type Column
} from '@connectio/shared-ui'
import { StatusBadge, fmt } from '../ui'
import { fetchOrderDetail } from '../api/orders'

// ----- helpers -----
function fmtSeconds(s: number | null | undefined) {
  if (!s && s !== 0) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
function fmtDate(ms: number | null | undefined) {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(ms: number | null | undefined) {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface OrderDetailProps {
  order: any
  onBack: () => void
  from?: 'list' | 'planning' | 'day-view' | 'pours' | 'yield' | 'quality' | 'vessel-planning'
}

function OrderDetail({ order, onBack, from = 'list' }: OrderDetailProps) {
  const { t } = useT()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insView, setInsView] = useState<'table' | 'tiles'>('table')
  const [_tweaksOpen, setTweaksOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchOrderDetail(order.id)
      .then(d => { if (!cancelled) { setDetail(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message || 'Failed to load order.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [order.id])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg = e?.data
      if (!msg || typeof msg !== 'object') return
      if (msg.type === '__activate_edit_mode') setTweaksOpen(true)
      if (msg.type === '__deactivate_edit_mode') setTweaksOpen(false)
    }
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ type: '__edit_mode_available' }, '*')
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const processOrderId = order.id

  const breadcrumbs = useMemo(() => {
    const base = [{ label: t.operations }]
    if (from === 'planning') return [...base, { label: t.crumbManufacturing || 'Manufacturing' }, { label: t.navPlanning, onClick: onBack }, { label: processOrderId }]
    if (from === 'pours') return [...base, { label: t.sectionInsights || 'Insights' }, { label: t.navPours || 'Pour analytics', onClick: onBack }, { label: processOrderId }]
    if (from === 'yield') return [...base, { label: t.sectionInsights || 'Insights' }, { label: t.navYield || 'Yield analytics', onClick: onBack }, { label: processOrderId }]
    if (from === 'quality') return [...base, { label: t.sectionInsights || 'Insights' }, { label: t.navQuality || 'Quality analytics', onClick: onBack }, { label: processOrderId }]
    return [...base, { label: t.crumbManufacturing }, { label: t.crumbOrders, onClick: onBack }, { label: processOrderId }]
  }, [from, t, processOrderId, onBack])

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={breadcrumbs} />

      <div className="detail-head" style={{ padding: '24px 32px', background: 'var(--surface-0)' }}>
        <Button variant="ghost" onClick={onBack} style={{ marginBottom: 12 }} icon={<Icon name="arrow-left" />}>
          {t.backAll}
        </Button>

        <div className="detail-id-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="id-block">
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="hexagon" size={14} />
              <span>{t.detailEyebrow}</span>
            </div>
            <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0 4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 'var(--fw-medium)', color: 'var(--text-1)', letterSpacing: '.01em' }}>{processOrderId}</span>
              <StatusBadge status={loading ? 'released' : (detail?.order?.status ?? order.status)} interactive={false} />
            </h1>
            <div className="detail-product" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {loading ? <span style={{ color: 'var(--text-3)' }}>Loading…</span>
                : detail ? detail.order.materialName
                  : <span style={{ color: 'var(--status-risk)' }}>—</span>}
              {detail && (
                <span className="sku" style={{ marginLeft: 12, opacity: 0.6 }}>
                  {t.sumMaterial} <span style={{ fontFamily: 'var(--font-mono)' }}>{detail.order.materialId}</span>
                  {detail.order.materialCategory ? ` · ${detail.order.materialCategory}` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="detail-actions" style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" icon={<Icon name="printer" />}>{t.actionPrintMBR}</Button>
            <Button variant="primary" icon={<Icon name="download" />}>{t.actionExportBundle}</Button>
          </div>
        </div>

        {detail && <SummaryGrid detail={detail} t={t} />}
        {detail && <SubMetaStrip detail={detail} t={t} />}
      </div>

      {loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          Loading order detail…
        </div>
      )}

      {error && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--status-risk)' }}>
          {error}
        </div>
      )}

      {detail && (
        <div style={{ padding: '0 32px 48px' }}>
          <div className="section-anchors" style={{ display: 'flex', gap: 24, padding: '16px 0', borderBottom: '1px solid var(--line-1)', marginBottom: 32 }}>
            <a href="#sec-activity" className="anchor" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', textDecoration: 'none' }}><Icon name="message-square" /><span>{t.secActivity || 'Activity'}</span><span className="pill" style={{ background: 'var(--line-1)', padding: '1px 6px', borderRadius: 'var(--r-pill)', fontSize: 11 }}>{detail.comments.length}</span></a>
            <a href="#sec-phases" className="anchor" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', textDecoration: 'none' }}><Icon name="layers" /><span>{t.secPhases || 'Phases & timing'}</span><span className="pill" style={{ background: 'var(--line-1)', padding: '1px 6px', borderRadius: 'var(--r-pill)', fontSize: 11 }}>{detail.phases.length}</span></a>
            <a href="#sec-materials" className="anchor" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', textDecoration: 'none' }}><Icon name="package" /><span>{t.tabMaterials}</span><span className="pill" style={{ background: 'var(--line-1)', padding: '1px 6px', borderRadius: 'var(--r-pill)', fontSize: 11 }}>{detail.materials.length}</span></a>
            <a href="#sec-qa" className="anchor" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', textDecoration: 'none' }}><Icon name="beaker" /><span>{t.secInspections || 'Inspections'}</span><span className="pill" style={{ background: 'var(--line-1)', padding: '1px 6px', borderRadius: 'var(--r-pill)', fontSize: 11 }}>{detail.inspections.length}</span></a>
          </div>

          <div className="all-sections">
            <section id="sec-activity" className="section-block" style={{ marginBottom: 48 }}>
              <SectionHeader icon="message-square" label={t.secActivity || 'Activity'} />
              <ActivitySection detail={detail} t={t} />
            </section>

            <section id="sec-phases" className="section-block" style={{ marginBottom: 48 }}>
              <SectionHeader icon="layers" label={t.secPhases || 'Phases & timing'} />
              <div className="phases-eq-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                <PhasesSection detail={detail} t={t} />
                <EquipmentCard detail={detail} t={t} />
              </div>
            </section>

            <section id="sec-materials" className="section-block" style={{ marginBottom: 48 }}>
              <SectionHeader icon="package" label={t.tabMaterials} />
              <MaterialsSection detail={detail} t={t} />
            </section>

            <section id="sec-qa" className="section-block" style={{ marginBottom: 48 }}>
              <SectionHeader icon="beaker" label={t.secInspections || 'Inspections'} />
              <InspectionsSection detail={detail} t={t} view={insView} setView={setInsView} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- Summary Grid -----
function SummaryGrid({ detail, t }: { detail: any, t: any }) {
  const { qtyIssuedKg, qtyReceivedKg } = detail.movementSummary
  const yieldVal = qtyReceivedKg && qtyIssuedKg ? (qtyReceivedKg / qtyIssuedKg) * 100 : null
  const o = detail.order
  return (
    <div className="pour-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginTop: 24, marginBottom: 12 }}>
      <KPI label={t.sumPOID || 'Process order'} value={o.processOrderId} subtext={o.plantId} icon="factory" />
      <KPI label={t.sumMaterial || 'Material'} value={o.materialId} subtext={o.materialCategory || '—'} icon="package" />
      <KPI label={t.sumBatch || 'Batch ID'} value={o.batchId || '—'} subtext={o.supplierBatchId ? 'Supplier ' + o.supplierBatchId : '—'} icon="layers" />
      <KPI
        label={t.sumQtyIssued || 'Qty issued'}
        value={fmtKg(qtyIssuedKg)}
        unit="kg"
        subtext={detail.materials.length + ' components'}
        icon="download"
      />
      <KPI
        label={t.sumQtyReceived || 'Qty received'}
        value={fmtKg(qtyReceivedKg)}
        unit="kg"
        subtext={o.status === 'running' ? 'In progress' : '101 receipt'}
        icon="upload"
      />
      <KPI
        label={t.sumYieldShort || 'Yield'}
        value={yieldVal ? yieldVal.toFixed(1) : '—'}
        unit="%"
        tone={yieldVal ? (yieldVal >= 95 ? 'ok' : 'warn') : 'neutral'}
        icon="trending-up"
      />
    </div>
  )
}

// ----- Sub meta strip (DOM / expiry / inspection lot) -----
function SubMetaStrip({ detail, t }: { detail: any, t: any }) {
  const o = detail.order
  return (
    <div className="submeta-strip" style={{ display: 'flex', gap: 32, padding: '12px 16px', background: 'var(--surface-sunken)', borderRadius: 'var(--r-md)', marginTop: 12 }}>
      <div className="sm-pill" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="calendar" size={14} style={{ color: 'var(--text-3)' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.sumDOM || 'Date of manufacture'}</div>
          <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)' }}>{fmtDate(o.manufactureDateMs)}</div>
        </div>
      </div>
      <div className="sm-pill" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="calendar" size={14} style={{ color: 'var(--text-3)' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.sumExpiry || 'Shelf life expiry'}</div>
          <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)' }}>{fmtDate(o.expiryDateMs)}</div>
        </div>
      </div>
      <div className="sm-pill" style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        <Icon name="shield" size={14} style={{ color: 'var(--text-3)' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase' }}>Inspection lot</div>
          <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font-mono)' }}>{o.inspectionLotId || '—'}</div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: string, label: string }) {
  return (
    <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <Icon name={icon as any} size={18} style={{ color: 'var(--valentia-slate)' }} />
      <h2 style={{ fontSize: 'var(--fs-18)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>{label}</h2>
      <div style={{ flex: 1, height: 1, background: 'var(--line-1)' }} />
    </div>
  )
}

// ----- Activity section (operator notes + side cards) -----
function ActivitySection({ detail, t }: { detail: any, t: any }) {
  return (
    <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
      <Card style={{ height: '100%' }}>
        <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="message-square" size={16} />
            <CardTitle>{t.cardComments || 'Operator notes'}</CardTitle>
          </div>
          <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--line-1)' }}>{detail.comments.length}</span>
        </CardHeader>
        <CardContent>
          <div className="comments-list">
            {detail.comments.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>{t.noComments}</div>
            ) : detail.comments.map((c: any, i: number) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < detail.comments.length - 1 ? '1px solid var(--line-1)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 13 }}>{c.sender || '—'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {fmtDateTime(c.createdMs)}
                    {c.phaseId ? ' · phase ' + c.phaseId : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{c.notes}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="side-stack">
        <DowntimeCard detail={detail} t={t} />
      </div>
    </div>
  )
}

function DowntimeCard({ detail, t }: { detail: any, t: any }) {
  const totalDur = detail.downtime.reduce((a: number, d: any) => a + d.durationS, 0)
  return (
    <Card>
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-triangle" size={16} style={{ color: 'var(--status-risk)' }} />
          <CardTitle>{t.cardDowntime || 'Downtime & issues'}</CardTitle>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{detail.downtime.length === 0 ? 'none' : detail.downtime.length + ' · ' + Math.round(totalDur / 60) + ' min'}</span>
      </CardHeader>
      <CardContent>
        {detail.downtime.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>{t.noDowntime || 'No downtime recorded.'}</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {detail.downtime.map((d: any, i: number) => (
              <li key={i} style={{ padding: '12px 0', borderBottom: i < detail.downtime.length - 1 ? '1px solid var(--line-1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 'var(--fw-extrabold)', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 'var(--r-sm)', background: 'var(--status-risk-bg)', color: 'var(--status-risk)' }}>{d.issueType}</span>
                  <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{d.issueTitle}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(d.durationS / 60)}m</span>
                  <span>·</span>
                  <span>{d.reasonCode}/{d.subReasonCode}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function EquipmentCard({ detail, t }: { detail: any, t: any }) {
  return (
    <Card>
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="cpu" size={16} />
          <CardTitle>{t.cardEquipment || 'Equipment activity'}</CardTitle>
        </div>
        <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--line-1)' }}>{detail.equipment.length}</span>
      </CardHeader>
      <CardContent>
        {detail.equipment.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>{t.noEquipment}</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {detail.equipment.map((e: any, i: number) => (
              <li key={i} style={{ padding: '12px 0', borderBottom: i < detail.equipment.length - 1 ? '1px solid var(--line-1)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)' }}>{e.equipmentType}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{fmtDateTime(e.changeAtMs)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>{e.statusFrom}</span>
                  <Icon name="arrow-right" size={12} style={{ opacity: 0.5 }} />
                  <span style={{ fontWeight: 'var(--fw-semibold)' }}>{e.statusTo}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ----- Phases section -----
function PhasesSection({ detail, t }: { detail: any, t: any }) {
  const phases = detail.phases
  const maxDurH = Math.max(...phases.map((p: any) => (p.setupS + p.machS + p.cleanS) / 3600), 0.001)

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="layers" size={16} />
            <CardTitle>{t.cardPhaseList || 'Process phases'}</CardTitle>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {phases.length} phases · {fmtSeconds(detail.timeSummary.setupS + detail.timeSummary.machS + detail.timeSummary.cleanS)}
          </span>
        </div>
      </CardHeader>

      <div style={{ padding: '0 18px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-1)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>{t.phaseColId}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>{t.phaseColDesc}</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>{t.phaseColQty}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', color: 'var(--text-3)' }}>Timing</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p: any) => {
              const setupH = p.setupS / 3600
              const machH = p.machS / 3600
              const cleanH = p.cleanS / 3600
              const totalH = setupH + machH + cleanH
              return (
                <tr key={p.phaseId} style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.phaseId}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{p.phaseDescription}</div>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.operationQuantity.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ height: 6, width: 200, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', width: (setupH / maxDurH * 100) + '%', background: 'var(--status-warn)' }} />
                      <div style={{ height: '100%', width: (machH / maxDurH * 100) + '%', background: 'var(--valentia-slate)' }} />
                      <div style={{ height: '100%', width: (cleanH / maxDurH * 100) + '%', background: 'var(--status-ok)' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{totalH.toFixed(2)} h</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ----- Materials & Movements section -----
function MaterialsSection({ detail, t }: { detail: any, t: any }) {
  const totalQty = detail.materials.reduce((a: number, m: any) => a + m.totalQty, 0)

  const materialColumns: Column<any>[] = [
    {
      header: t.matMaterial,
      render: (m) => (
        <div style={{ paddingLeft: 4 }}>
          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{m.materialName || m.materialId}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{m.materialId}</div>
        </div>
      )
    },
    {
      header: t.matLotSupplier || 'Batch',
      render: (m) => <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--valentia-slate)' }}>{m.batchId || '—'}</div>
    },
    {
      header: t.matActual || 'Qty used',
      align: 'right',
      render: (m) => <span style={{ fontFamily: 'var(--font-mono)' }}>{m.totalQty.toFixed(3)}</span>
    }
  ]

  return (
    <Card>
      <CardHeader style={{ borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="package" size={16} />
          <CardTitle>{t.cardBOM}</CardTitle>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{detail.materials.length} {t.items} · {totalQty.toFixed(3)} kg {t.consumed}</span>
      </CardHeader>

      <DataTable columns={materialColumns} rows={detail.materials} dense />

      <div style={{ padding: '8px 18px', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
        <span>{t.matTotal}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{totalQty.toFixed(3)} <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 }}>kg</span></span>
      </div>
    </Card>
  )
}

// ----- Inspections section -----
function InspectionsSection({ detail, t, view, setView }: { detail: any, t: any, view: 'table' | 'tiles', setView: (v: 'table' | 'tiles') => void }) {
  const allPass = detail.inspections.length > 0 && detail.inspections.every((x: any) => x.judgement === 'A')

  const columns: Column<any>[] = [
    {
      header: 'ID',
      render: (ins) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{ins.characteristicId}</span>
    },
    {
      header: t.insColChar,
      render: (ins) => <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)' }}>{ins.characteristicDescription}</div>
    },
    {
      header: t.insColSpec,
      render: (ins) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-3)' }}>{ins.specification || '—'}</span>
    },
    {
      header: t.insColResult,
      render: (ins) => (
        <span style={{ fontWeight: 'var(--fw-bold)', color: ins.judgement === 'A' ? 'var(--status-ok)' : 'var(--status-risk)' }}>
          {ins.qualitativeResult || ins.quantitativeResult || '—'}
          <span style={{ marginLeft: 4, fontWeight: 400, fontSize: 11 }}>{ins.uom}</span>
        </span>
      )
    },
    {
      header: t.insColJudge,
      align: 'right',
      render: (ins) => (
        <span style={{ 
          background: ins.judgement === 'A' ? 'var(--status-ok-bg)' : 'var(--status-risk-bg)', 
          color: ins.judgement === 'A' ? 'var(--status-ok)' : 'var(--status-risk)',
          padding: '2px 8px', borderRadius: 'var(--r-sm)', fontWeight: 'var(--fw-extrabold)', fontSize: 11
        }}>
          {ins.judgement}
        </span>
      )
    }
  ]

  return (
    <div className="detail-grid">
      <Card style={{ height: '100%' }}>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="beaker" size={16} />
              <CardTitle>{t.cardInspectionResults || 'Inspection results'}</CardTitle>
            </div>
            <div style={{ display: 'flex', background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 2 }}>
              <button className={`btn btn-xs ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, fontSize: 10 }} onClick={() => setView('table')}>Table</button>
              <button className={`btn btn-xs ${view === 'tiles' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, fontSize: 10 }} onClick={() => setView('tiles')}>Tiles</button>
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, display: 'block' }}>
            {detail.inspections.length === 0 ? 'No results' : allPass ? t.allWithinSpec : 'Has rejections'}
          </span>
        </CardHeader>

        {view === 'table' ? (
          <DataTable columns={columns} rows={detail.inspections} dense />
        ) : (
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {detail.inspections.map((ins: any, i: number) => (
                <div key={i} style={{ padding: 12, border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{ins.characteristicDescription}</div>
                  <div style={{ fontSize: 'var(--fs-16)', fontWeight: 'var(--fw-bold)', color: ins.judgement === 'A' ? 'var(--status-ok)' : 'var(--status-risk)' }}>
                    {ins.qualitativeResult || ins.quantitativeResult || '—'}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 4 }}>Spec: {ins.specification}</div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="side-stack">
        <UsageDecisionCard ud={detail.usageDecision} t={t} />
      </div>
    </div>
  )
}

function UsageDecisionCard({ ud, t }: { ud: any, t: any }) {
  if (!ud) {
    return (
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="flag" size={16} />
            <CardTitle>{t.cardUsageDecision || 'Usage decision'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ padding: 16, textAlign: 'center', background: 'var(--surface-sunken)', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)', color: 'var(--text-2)' }}>{t.udPending || 'Pending decision'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Awaiting QA review · no decision recorded yet.</div>
          </div>
        </CardContent>
      </Card>
    )
  }
  const accepted = ud.valuationCode === 'A'
  return (
    <Card style={{ borderLeft: `4px solid ${accepted ? 'var(--status-ok)' : 'var(--status-risk)'}` }}>
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="flag" size={16} style={{ color: accepted ? 'var(--status-ok)' : 'var(--status-risk)' }} />
          <CardTitle>{t.cardUsageDecision || 'Usage decision'}</CardTitle>
        </div>
        <span style={{ background: accepted ? 'var(--status-ok)' : 'var(--status-risk)', color: 'var(--fg-on-brand)', padding: '2px 8px', borderRadius: 'var(--r-sm)', fontWeight: 'var(--fw-extrabold)', fontSize: 'var(--fs-12)' }}>{accepted ? 'A' : 'R'}</span>
      </CardHeader>
      <CardContent>
        <div style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', marginBottom: 16 }}>{ud.usageDecisionCode || '—'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', fontSize: 10, fontWeight: 'var(--fw-bold)' }}>Code</div>
            <div style={{ fontWeight: 'var(--fw-semibold)' }}>{ud.usageDecisionCode}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', fontSize: 10, fontWeight: 'var(--fw-bold)' }}>Score</div>
            <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-16)', color: accepted ? 'var(--status-ok)' : 'var(--status-risk)' }}>{ud.qualityScore}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { OrderDetail }
