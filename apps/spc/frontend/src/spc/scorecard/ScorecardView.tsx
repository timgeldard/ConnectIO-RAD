/* eslint-disable jsdoc/require-jsdoc */
import { Suspense, lazy } from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import {
  ReportingDashboard,
  DashboardFilterProvider,
  ReportPageShell,
  createDefaultReportingRegistry,
  useDashboardFilters,
  type DashboardConfig,
  type DashboardFilters,
  type FilterConfig,
} from '@connectio/shared-reporting'
import '../charts/ensureEChartsTheme'
import { shallowEqual, useSPCSelector } from '../SPCContext'
import { useSPCScorecard } from '../hooks/useSPCScorecard'

const ScorecardTable = lazy(() => import('./ScorecardTable'))
const scorecardRegistry = createDefaultReportingRegistry()

function ScorecardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 48,
            borderRadius: 6,
            background: 'var(--surface-2)',
            opacity: 1 - i * 0.08,
            animation: 'fadeIn 400ms ease both',
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
    </div>
  )
}

interface ScorecardFilterLabels {
  material: string
  plant: string
  timeRange: string
}

function ScorecardFilterSummary({ labels }: { labels: ScorecardFilterLabels }) {
  const { t } = useI18n()
  const { filters } = useDashboardFilters()
  const timeRange = filters.timeRange
  const timeLabel = typeof timeRange === 'object' && timeRange != null && !Array.isArray(timeRange)
    ? `${timeRange.from ?? '...'} to ${timeRange.to ?? '...'}`
    : labels.timeRange

  return (
    <div aria-label="Scorecard scope" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <span className="chip">{t('spc.scorecard.filter.material')}: {labels.material}</span>
      <span className="chip">{t('spc.scorecard.filter.plant')}: {labels.plant}</span>
      <span className="chip">{t('spc.scorecard.filter.date')}: {timeLabel}</span>
    </div>
  )
}

export default function ScorecardView() {
  const { t } = useI18n()
  const state = useSPCSelector(
    current => ({
      roleMode: current.roleMode,
      selectedMaterial: current.selectedMaterial,
      selectedPlant: current.selectedPlant,
      selectedMIC: current.selectedMIC,
      exclusionAudit: current.exclusionAudit,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    }),
    shallowEqual,
  )

  const { scorecard, loading, error } = useSPCScorecard(
    state.selectedMaterial?.material_id,
    state.dateFrom,
    state.dateTo,
    state.selectedPlant?.plant_id,
  )

  // ── Empty / loading / error guards ─────────────────────────────────────────

  if (!state.selectedMaterial) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>▦</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>{t('spc.scorecard.emptyMaterial.title')}</div>
        <div>{t('spc.scorecard.emptyMaterial.body')}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 100, borderRadius: 10, background: 'var(--surface-2)' }} />
          ))}
        </div>
        <ScorecardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        margin: 20, padding: '14px 18px', borderRadius: 10,
        background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
        color: 'var(--status-risk)', fontSize: 13,
      }}>
        <strong>{t('spc.scorecard.error')}</strong> — {String(error)}
      </div>
    )
  }

  if (!scorecard.length) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>{t('spc.scorecard.emptyData.title')}</div>
        <div>{t('spc.scorecard.emptyData.body', { material: state.selectedMaterial.material_name ?? state.selectedMaterial.material_id })}</div>
      </div>
    )
  }

  // ── KPI derivations ────────────────────────────────────────────────────────

  const capable   = scorecard.filter(r => (r.cpk ?? 0) >= 1.33).length
  const marginal  = scorecard.filter(r => { const c = r.cpk ?? 99; return c >= 1 && c < 1.33 }).length
  const withSignals = scorecard.filter(r => (r.ooc_rate ?? 0) > 0).length

  const materialLabel = state.selectedMaterial.material_name ?? state.selectedMaterial.material_id
  const plantLabel = state.selectedPlant?.plant_name ?? state.selectedPlant?.plant_id ?? 'All plants'
  const reportingFilters: FilterConfig[] = [
    {
      id: 'material',
      label: t('spc.scorecard.filter.material'),
      kind: 'material',
      defaultValue: state.selectedMaterial.material_id,
    },
    {
      id: 'plant',
      label: t('spc.scorecard.filter.plant'),
      kind: 'plant',
      defaultValue: state.selectedPlant?.plant_id ?? null,
    },
    {
      id: 'timeRange',
      label: t('spc.scorecard.filter.date'),
      kind: 'timeRange',
      defaultValue: { from: state.dateFrom, to: state.dateTo },
    },
  ]
  const reportingFilterValues: DashboardFilters = {
    material: state.selectedMaterial.material_id,
    plant: state.selectedPlant?.plant_id ?? null,
    timeRange: { from: state.dateFrom, to: state.dateTo },
  }
  const reportingFilterKey = `${reportingFilterValues.material}:${reportingFilterValues.plant ?? 'all'}:${state.dateFrom}:${state.dateTo}`
  const dashboardConfig: DashboardConfig = {
    id: 'spc-scorecard-summary',
    title: t('spc.scorecard.eyebrow'),
    filters: reportingFilters,
    layout: { columns: 12, gap: 14 },
    widgets: [
      {
        id: 'characteristics',
        type: 'kpi',
        title: t('spc.scorecard.kpi.characteristics'),
        props: {
          value: scorecard.length,
          unit: t('spc.scorecard.kpi.characteristics.unit'),
          tone: 'neutral',
          delta: t('spc.scorecard.kpi.characteristics.delta'),
        },
        interactions: [],
        layout: { colSpan: 3 },
      },
      {
        id: 'capable',
        type: 'kpi',
        title: t('spc.scorecard.kpi.capable'),
        props: {
          value: capable,
          unit: t('spc.scorecard.kpi.capable.unit', { total: scorecard.length }),
          tone: 'ok',
          delta: t('spc.scorecard.kpi.capable.delta'),
        },
        interactions: [],
        layout: { colSpan: 3 },
      },
      {
        id: 'marginal',
        type: 'kpi',
        title: t('spc.scorecard.kpi.marginal'),
        props: {
          value: marginal,
          tone: 'warn',
          delta: t('spc.scorecard.kpi.marginal.delta'),
        },
        interactions: [],
        layout: { colSpan: 3 },
      },
      {
        id: 'signals-open',
        type: 'kpi',
        title: t('spc.scorecard.kpi.signalsOpen'),
        props: {
          value: withSignals,
          tone: withSignals > 0 ? 'risk' : 'ok',
          delta: withSignals > 0 ? t('spc.scorecard.kpi.signalsOpen.delta.ooc') : t('spc.scorecard.kpi.signalsOpen.delta.clear'),
        },
        interactions: [],
        layout: { colSpan: 3 },
      },
    ],
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <DashboardFilterProvider key={reportingFilterKey} filters={reportingFilters} initialValues={reportingFilterValues}>
        <ReportPageShell
          title={t('spc.scorecard.eyebrow')}
          description={materialLabel}
          filters={<ScorecardFilterSummary labels={{ material: materialLabel, plant: plantLabel, timeRange: `${state.dateFrom} to ${state.dateTo}` }} />}
        >
          <ReportingDashboard config={dashboardConfig} registry={scorecardRegistry} />
          <Suspense fallback={<ScorecardSkeleton />}>
            <ScorecardTable rows={scorecard} material={materialLabel} />
          </Suspense>
        </ReportPageShell>
      </DashboardFilterProvider>
    </div>
  )
}
