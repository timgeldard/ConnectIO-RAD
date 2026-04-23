import { useMemo } from 'react'
import { Icon } from '../../components/ui/Icon'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../SPCContext'
import { useSPCFlow } from '../hooks/useSPCFlow'
import { useSPCScorecard } from '../hooks/useSPCScorecard'
import ProcessFlowMiniMap from '../flow/ProcessFlowMiniMap'
import KPICard from './KPICard'
import RecentViolations from './RecentViolations'
import type { KPITone } from './KPICard'

export default function OverviewPage() {
  const dispatch = useSPCDispatch()
  const {
    selectedMaterial,
    selectedPlant,
    selectedMIC,
    processFlowUpstreamDepth,
    processFlowDownstreamDepth,
    dateFrom,
    dateTo,
  } = useSPCSelector(
    state => ({
      selectedMaterial: state.selectedMaterial,
      selectedPlant: state.selectedPlant,
      selectedMIC: state.selectedMIC,
      processFlowUpstreamDepth: state.processFlowUpstreamDepth,
      processFlowDownstreamDepth: state.processFlowDownstreamDepth,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
    }),
    shallowEqual,
  )

  const hasScope = Boolean(selectedMaterial)
  const hasCharacteristic = Boolean(selectedMIC)
  const materialLabel = selectedMaterial?.material_name || selectedMaterial?.material_id || 'No material selected'
  const plantLabel = selectedPlant?.plant_name || selectedPlant?.plant_id || 'All plants'

  const { scorecard, loading: scorecardLoading } = useSPCScorecard(
    selectedMaterial?.material_id,
    dateFrom,
    dateTo,
    selectedPlant?.plant_id,
  )
  const { flowData, loading: flowLoading } = useSPCFlow(
    selectedMaterial?.material_id,
    dateFrom,
    dateTo,
    processFlowUpstreamDepth,
    processFlowDownstreamDepth,
  )

  const derivedKpis = useMemo(() => {
    if (!scorecard.length) return { processHealth: 0, avgCpk: 0, oocPoints: 0, affectedBatches: 0 }
    const capabilityValues = scorecard
      .map(row => row.cpk ?? row.ppk)
      .filter((v): v is number => v != null)
    const healthyCount = scorecard.filter(
      row => (row.cpk ?? row.ppk ?? 0) >= 1.33 && (row.ooc_rate ?? 0) <= 0.02,
    ).length
    return {
      processHealth: Math.round((healthyCount / scorecard.length) * 100),
      avgCpk: capabilityValues.length
        ? Number((capabilityValues.reduce((s, v) => s + v, 0) / capabilityValues.length).toFixed(2))
        : 0,
      oocPoints: scorecard.filter(row => (row.ooc_rate ?? 0) > 0).length,
      affectedBatches: scorecard.reduce(
        (sum, row) => sum + Math.max(0, Math.round((row.batch_count ?? 0) * (row.ooc_rate ?? 0))),
        0,
      ),
    }
  }, [scorecard])

  const capBuckets = useMemo(() => {
    const excellent = scorecard.filter(r => (r.cpk ?? r.ppk ?? 0) >= 1.67).length
    const capable   = scorecard.filter(r => { const v = r.cpk ?? r.ppk ?? 0; return v >= 1.33 && v < 1.67 }).length
    const marginal  = scorecard.filter(r => { const v = r.cpk ?? r.ppk ?? 0; return v >= 1.00 && v < 1.33 }).length
    const poor      = scorecard.filter(r => (r.cpk ?? r.ppk ?? 0) < 1.00).length
    return { excellent, capable, marginal, poor, total: scorecard.length }
  }, [scorecard])

  const derivedViolations = useMemo(() => {
    const flowViolations = (flowData?.nodes ?? [])
      .filter(node => Boolean(node.last_ooc || node.has_ooc_signal) || (typeof node.estimated_cpk === 'number' && node.estimated_cpk < 1) || (typeof node.rejection_rate_pct === 'number' && node.rejection_rate_pct >= 2))
      .sort((a, b) => String(b.last_ooc ?? '').localeCompare(String(a.last_ooc ?? '')))
      .slice(0, 5)
      .map((node, i) => ({
        id: i + 1,
        time: node.last_ooc ? String(node.last_ooc) : 'In scope',
        rule: node.has_ooc_signal || node.last_ooc ? 'OOC signal' : 'Capability below target',
        chart: node.material_name ?? node.material_id ?? '',
        value: typeof node.rejection_rate_pct === 'number'
          ? `${node.rejection_rate_pct.toFixed(1)}% rejection`
          : node.estimated_cpk != null
            ? `Cpk ${node.estimated_cpk.toFixed(2)}`
            : 'Review node',
      }))
    if (flowViolations.length > 0) return flowViolations
    return scorecard
      .filter(row => (row.ooc_rate ?? 0) > 0 || (row.cpk ?? row.ppk ?? 999) < 1.33)
      .sort((a, b) => (b.ooc_rate ?? 0) - (a.ooc_rate ?? 0) || (a.cpk ?? a.ppk ?? 999) - (b.cpk ?? b.ppk ?? 999))
      .slice(0, 5)
      .map((row, i) => ({
        id: i + 1,
        time: `${row.batch_count} batches`,
        rule: (row.ooc_rate ?? 0) > 0.02 ? 'Elevated OOC rate' : 'Low capability',
        chart: row.mic_name ?? '',
        value: (row.ooc_rate ?? 0) > 0
          ? `${((row.ooc_rate ?? 0) * 100).toFixed(1)}% OOC`
          : `Cpk ${(row.cpk ?? row.ppk ?? 0).toFixed(2)}`,
      }))
  }, [flowData?.nodes, scorecard])

  const isLoading = hasScope && (scorecardLoading || flowLoading)

  // Derived hero headline
  const heroHeadline = useMemo(() => {
    if (!hasScope) return { main: 'Welcome to the SPC Workspace.', sub: 'Select a material in the filter bar to begin analysis.' }
    if (isLoading) return { main: 'Loading process data…', sub: `${materialLabel} · ${plantLabel}` }
    if (derivedKpis.processHealth >= 85)
      return { main: 'Process is capable and in control.', sub: `${materialLabel} · ${plantLabel} — all key characteristics within limits.` }
    if (derivedKpis.oocPoints > 0)
      return {
        main: `${derivedKpis.oocPoints} characteristic${derivedKpis.oocPoints !== 1 ? 's' : ''} showing signals — review today.`,
        sub: `${materialLabel} · ${plantLabel} — process health ${derivedKpis.processHealth}%.`,
      }
    return { main: 'Review capability — some characteristics are marginal.', sub: `${materialLabel} · ${plantLabel}` }
  }, [hasScope, isLoading, derivedKpis, materialLabel, plantLabel])

  // KPI tone helpers
  const healthTone = (h: number): KPITone => h >= 85 ? 'ok' : h >= 65 ? 'warn' : 'risk'
  const cpkTone    = (c: number): KPITone => c >= 1.33 ? 'ok' : c >= 1 ? 'warn' : 'risk'
  const oocTone    = (n: number): KPITone => n === 0 ? 'ok' : n <= 2 ? 'warn' : 'risk'
  const batchTone  = (n: number): KPITone => n === 0 ? 'ok' : 'risk'

  // Loading skeleton
  if (isLoading) {
    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ height: 140, borderRadius: 14, background: 'var(--surface-2)', animation: 'pulse 1.5s ease infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 10, background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }} className="fade-in">

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--valentia-slate) 0%, #003F57 100%)',
        borderRadius: 14,
        padding: '22px 26px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative micro-shapes */}
        <svg viewBox="0 0 400 220" style={{ position: 'absolute', right: -40, top: -20, width: 420, height: 260, opacity: 0.15, pointerEvents: 'none' }}>
          <circle cx="300" cy="110" r="110" fill="none" stroke="white" strokeWidth="1" />
          <polygon points="320,20 370,48 370,104 320,132 270,104 270,48" fill="none" stroke="white" strokeWidth="1" />
          <polygon points="110,160 160,188 160,244 110,272 60,244 60,188" fill="none" stroke="var(--innovation)" strokeWidth="1.2" />
        </svg>

        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
            Operational quality · SPC
          </div>
          <div style={{ fontFamily: 'var(--font-impact)', fontSize: 28, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.02, letterSpacing: '-0.01em', maxWidth: 680 }}>
            {heroHeadline.main.includes('signal') || heroHeadline.main.includes('capable') ? (
              <>
                {heroHeadline.main.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: 'var(--innovation)' }}>{heroHeadline.main.split(' ').slice(-1)[0]}</span>
              </>
            ) : heroHeadline.main}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, maxWidth: 500, lineHeight: 1.4, opacity: 0.9 }}>
              {heroHeadline.sub}
            </div>
            {hasScope && hasCharacteristic && (
              <button
                className="btn btn-lg"
                style={{ background: 'var(--innovation)', color: 'var(--forest)', marginLeft: 'auto', border: 'none' }}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'charts' })}
              >
                Investigate signal <Icon name="arrow-right" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPICard
          label="Process Health"
          value={hasScope ? `${derivedKpis.processHealth}` : '—'}
          unit={hasScope ? '%' : undefined}
          tone={hasScope ? healthTone(derivedKpis.processHealth) : 'neutral'}
          icon="activity"
        />
        <KPICard
          label="Avg Cpk"
          value={hasScope ? derivedKpis.avgCpk || '—' : '—'}
          tone={hasScope ? cpkTone(derivedKpis.avgCpk) : 'neutral'}
          icon="target"
        />
        <KPICard
          label="Out of Control"
          value={hasScope ? derivedKpis.oocPoints : '—'}
          unit={hasScope && derivedKpis.oocPoints !== 1 ? 'chars' : hasScope ? 'char' : undefined}
          tone={hasScope ? oocTone(derivedKpis.oocPoints) : 'neutral'}
          icon="alert-triangle"
        />
        <KPICard
          label="Affected Batches"
          value={hasScope ? derivedKpis.affectedBatches : '—'}
          tone={hasScope ? batchTone(derivedKpis.affectedBatches) : 'neutral'}
          icon="flag"
        />
      </div>

      {/* Signals + Flow preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <RecentViolations hasMaterial={hasScope} violations={derivedViolations} />
        <FlowPreview
          flowData={flowData}
          flowLoading={flowLoading}
          hasScope={hasScope}
          materialLabel={materialLabel}
          plantLabel={plantLabel}
          onOpenFlow={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'flow' })}
        />
      </div>

      {/* Capability summary + Genie tease */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <CapabilitySummary buckets={capBuckets} hasScope={hasScope} />
        <GenieTease onOpenGenie={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'genie' })} onOpenCharts={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'charts' })} />
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface FlowPreviewProps {
  flowData: ReturnType<typeof useSPCFlow>['flowData']
  flowLoading: boolean
  hasScope: boolean
  materialLabel: string
  plantLabel: string
  onOpenFlow: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FlowPreview({ flowData, flowLoading, hasScope, materialLabel, plantLabel, onOpenFlow }: FlowPreviewProps) {
  const nodeCount = flowData?.nodes?.length ?? 0
  const edgeCount = flowData?.edges?.length ?? 0

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'color-mix(in srgb, var(--valentia-slate) 12%, transparent)',
          color: 'var(--valentia-slate)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="git-branch" size={15} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Process lineage</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {hasScope && nodeCount > 0
              ? `${nodeCount} nodes · ${edgeCount} edges`
              : hasScope ? 'Loading…' : 'Select a material'}
          </div>
        </div>
        <button className="btn-link" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={onOpenFlow}>
          Open flow →
        </button>
      </div>
      <div style={{ flex: 1, background: 'var(--surface-2)', minHeight: 240 }}>
        {hasScope ? (
          <ProcessFlowMiniMap flowData={flowData} loading={flowLoading} />
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Select a material to load the process graph.
          </div>
        )}
      </div>
      <div style={{ padding: '8px 18px', borderTop: '1px solid var(--line-1)', display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="dot dot-ok" /> Capable</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="dot dot-warn" /> Marginal</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="dot dot-risk" /> OOC signal</span>
      </div>
    </div>
  )
}

interface CapBuckets {
  excellent: number
  capable: number
  marginal: number
  poor: number
  total: number
}

function CapabilitySummary({ buckets, hasScope }: { buckets: CapBuckets; hasScope: boolean }) {
  const bars = [
    { label: 'Highly capable (Cpk ≥ 1.67)', count: buckets.excellent, tone: 'ok' as const, pct: buckets.total ? (buckets.excellent / buckets.total) * 100 : 0 },
    { label: 'Capable (≥ 1.33)',            count: buckets.capable,   tone: 'ok' as const, pct: buckets.total ? (buckets.capable   / buckets.total) * 100 : 0 },
    { label: 'Marginal (≥ 1.00)',           count: buckets.marginal,  tone: 'warn' as const, pct: buckets.total ? (buckets.marginal  / buckets.total) * 100 : 0 },
    { label: 'Not capable (< 1.00)',        count: buckets.poor,      tone: 'risk' as const, pct: buckets.total ? (buckets.poor      / buckets.total) * 100 : 0 },
  ]

  const toneColor = { ok: 'var(--status-ok)', warn: 'var(--status-warn)', risk: 'var(--status-risk)' }

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Capability distribution</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: 'var(--text-1)' }}>
            {hasScope && buckets.total > 0 ? `${buckets.total} characteristics monitored` : 'No data loaded'}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>last window</span>
      </div>

      {hasScope && buckets.total > 0 ? (
        <>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            {bars.filter(b => b.count > 0).map((b, i) => (
              <div key={i} style={{ width: `${b.pct}%`, background: toneColor[b.tone], transition: 'width 400ms var(--ease-out)' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div className={`dot dot-${b.tone === 'ok' ? 'ok' : b.tone === 'warn' ? 'warn' : 'risk'}`} style={{ width: 10, height: 10, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{b.label}</div>
                <div className="mono" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{b.count}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
          {hasScope ? 'No scorecard data available for this scope.' : 'Select a material to see capability distribution.'}
        </div>
      )}
    </div>
  )
}

function GenieTease({ onOpenGenie, onOpenCharts }: { onOpenGenie: () => void; onOpenCharts: () => void }) {
  const prompts = [
    'Why did this characteristic drift past UCL?',
    'Summarise this week in 3 bullets',
    'Which batches were affected?',
  ]
  return (
    <div className="card" style={{
      padding: 18,
      background: 'linear-gradient(160deg, var(--forest) 0%, #051C00 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      border: 'none',
    }}>
      <svg viewBox="0 0 280 200" style={{ position: 'absolute', right: -20, top: -10, width: 240, opacity: 0.15, pointerEvents: 'none' }}>
        <polygon points="140,20 200,55 200,125 140,160 80,125 80,55" fill="none" stroke="var(--innovation)" strokeWidth="1.2" />
        <circle cx="140" cy="90" r="40" fill="none" stroke="var(--innovation)" strokeWidth="0.8" />
      </svg>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--innovation)', color: 'var(--forest)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkles" size={15} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Ask Genie</div>
          <span style={{ fontSize: 9, padding: '2px 5px', background: 'var(--innovation)', color: 'var(--forest)', borderRadius: 3, fontWeight: 700, letterSpacing: '0.05em' }}>AI</span>
        </div>
        <div className="serif" style={{ fontSize: 13, lineHeight: 1.45, color: '#E9EFDE', marginBottom: 14 }}>
          Let Databricks Genie help you investigate signals, correlate variables, and summarise process performance.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prompts.map(p => (
            <button
              key={p}
              type="button"
              onClick={onOpenGenie}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#E9EFDE',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-sans)',
                transition: 'background 140ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
            >
              <Icon name="sparkles" size={11} style={{ color: 'var(--innovation)', flexShrink: 0 }} />
              {p}
            </button>
          ))}
        </div>
        <button
          className="btn btn-sm"
          style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', color: '#E9EFDE', border: '1px solid rgba(255,255,255,0.15)' }}
          onClick={onOpenCharts}
        >
          <Icon name="activity" size={13} />
          Go to Control Charts
        </button>
      </div>
    </div>
  )
}
