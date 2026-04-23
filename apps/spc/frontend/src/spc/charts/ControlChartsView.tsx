import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import './ensureEChartsTheme'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../SPCContext'
import { useControlChartsController } from '../hooks/useControlChartsController'
import { useDataQuality } from '../hooks/useDataQuality'
import type { LockedLimits, SPCComputationResult } from '../types'
import ChartCard from './ChartCard'
import ChartInfoBanners from './ChartInfoBanners'
import ChartSettingsRail from './ChartSettingsRail'
import ChartSummaryBar from './ChartSummaryBar'
import StratificationPanel from './StratificationPanel'

const IndividualsChart            = lazy(() => import('./IndividualsChart'))
const MovingRangeChart            = lazy(() => import('./MovingRangeChart'))
const XbarChart                   = lazy(() => import('./XbarChart'))
const RangeChart                  = lazy(() => import('./RangeChart'))
const SigmaChart                  = lazy(() => import('./SigmaChart'))
const EWMAChart                   = lazy(() => import('./EWMAChart'))
const CUSUMChart                  = lazy(() => import('./CUSUMChart'))
const PChart                      = lazy(() => import('./PChart'))
const CChart                      = lazy(() => import('./CChart'))
const UChart                      = lazy(() => import('./UChart'))
const NPChart                     = lazy(() => import('./NPChart'))
const CapabilityPanel             = lazy(() => import('./CapabilityPanel'))
const CapabilityTrendChart        = lazy(() => import('./CapabilityTrendChart'))
const DataQualityPanel            = lazy(() => import('./DataQualityPanel'))
const ExcludedPointsPanel         = lazy(() => import('./ExcludedPointsPanel'))
const ExclusionJustificationModal = lazy(() => import('./ExclusionJustificationModal'))
const SignalsPanel                = lazy(() => import('./SignalsPanel'))

// ── Types ──────────────────────────────────────────────────────────────────

type PanelId = 'primary' | 'capability' | 'dataQuality' | 'signals' | 'trend' | 'exclusions' | 'stratification'

const DEFAULT_VISIBLE_PANELS: PanelId[] = [
  'primary', 'capability', 'dataQuality', 'signals', 'trend', 'exclusions', 'stratification',
]

// ── Loading skeleton ───────────────────────────────────────────────────────

function ChartSkeleton({ height = '520px' }: { height?: string }) {
  return (
    <div style={{ width: '100%', height, background: 'var(--surface-2)', borderRadius: 10 }} />
  )
}

// ── Quantitative chart switcher (ECharts logic preserved) ─────────────────

function renderQuantitativeChart(
  spcResult: SPCComputationResult,
  limits: LockedLimits | null,
  excludedSet: Set<number>,
  onPointClick?: (index: number) => void,
) {
  return (
    <Suspense fallback={<ChartSkeleton height="520px" />}>
      {spcResult.chartType === 'imr' ? (
        <>
          <IndividualsChart
            spc={spcResult}
            indexedPoints={spcResult.indexedPoints}
            signals={spcResult.signals}
            excludedIndices={excludedSet}
            onPointClick={onPointClick}
            externalLimits={limits}
          />
          <MovingRangeChart
            spc={spcResult}
            indexedPoints={spcResult.indexedPoints ?? []}
            mrSignals={spcResult.mrSignals ?? []}
            externalUclMr={limits?.ucl_r}
          />
        </>
      ) : spcResult.chartType === 'ewma' ? (
        <EWMAChart
          spc={spcResult}
          signals={spcResult.signals}
          indexedPoints={spcResult.indexedPoints}
          onPointClick={onPointClick}
        />
      ) : spcResult.chartType === 'cusum' ? (
        <CUSUMChart
          spc={spcResult}
          signals={spcResult.signals}
          indexedPoints={spcResult.indexedPoints}
          onPointClick={onPointClick}
        />
      ) : (
        <>
          <XbarChart
            spc={spcResult}
            signals={spcResult.signals}
            externalLimits={limits}
          />
          {spcResult.chartType === 'xbar_s' ? (
            <SigmaChart
              spc={spcResult}
              mrSignals={spcResult.mrSignals ?? []}
              externalUclS={limits?.ucl_r}
            />
          ) : (
            <RangeChart
              spc={spcResult}
              mrSignals={spcResult.mrSignals ?? []}
              externalUclR={limits?.ucl_r}
            />
          )}
        </>
      )}
    </Suspense>
  )
}

// ── Panel selector ─────────────────────────────────────────────────────────

function PanelSelector({
  availablePanels,
  visiblePanels,
  onToggle,
  stratifyLabel,
}: {
  availablePanels: Array<{ id: PanelId; label: string; description: string; disabled?: boolean }>
  visiblePanels: PanelId[]
  onToggle: (panelId: PanelId) => void
  stratifyLabel: string | null
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Display panels</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {availablePanels.map(panel => (
          <div key={panel.id}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: panel.disabled ? 'default' : 'pointer', fontSize: 13,
                color: panel.disabled ? 'var(--text-4)' : 'var(--text-1)',
              }}
            >
              <input
                type="checkbox"
                id={`panel-toggle-${panel.id}`}
                checked={visiblePanels.includes(panel.id)}
                onChange={() => !panel.disabled && onToggle(panel.id)}
                disabled={panel.disabled}
                style={{ accentColor: 'var(--valentia-slate)', width: 14, height: 14, cursor: panel.disabled ? 'default' : 'pointer', flexShrink: 0 }}
              />
              {panel.label}
            </label>
            <p style={{ margin: '2px 0 0 22px', fontSize: 11, color: 'var(--text-4)' }}>
              {panel.description}
            </p>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--line-1)', paddingTop: 12 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
          Stratification
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>
          {stratifyLabel
            ? `Current view is stratified by ${stratifyLabel}.`
            : 'Line, shift, lot, and plant context are inherited from the top filter bar.'}
        </p>
      </div>
    </div>
  )
}

// ── Auto-clean result panel ────────────────────────────────────────────────

function AutoCleanLog({
  log,
  onDismiss,
}: {
  log: NonNullable<ReturnType<typeof useControlChartsController>['autoCleanLog']>
  onDismiss: () => void
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: 'var(--text-1)' }}>Phase I Auto-clean result</strong>
        {log.stable
          ? (
            <span className="chip chip-ok" style={{ fontSize: 11 }}>
              Stable after {log.iterationLog.length} iteration{log.iterationLog.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="chip" style={{ fontSize: 11 }}>
              Not fully stable — {log.cleanedIndices.size} point{log.cleanedIndices.size !== 1 ? 's' : ''} excluded
            </span>
          )}
        <button className="btn btn-ghost btn-sm" onClick={onDismiss} style={{ marginLeft: 'auto' }}>Dismiss</button>
      </div>
      {log.iterationLog.map((iter, i) => (
        <p key={i} style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>
          Iteration {iter.iteration}: removed {iter.removedCount} point{iter.removedCount !== 1 ? 's' : ''}
          {iter.removedCount > 0 && ` (indices: ${iter.removedOriginalIndices.join(', ')})`}
          {' '}· UCL={iter.ucl?.toFixed(4) ?? '—'}, CL={iter.cl?.toFixed(4) ?? '—'}, LCL={iter.lcl?.toFixed(4) ?? '—'}
        </p>
      ))}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function ControlChartsView() {
  const dispatch = useSPCDispatch()
  const state = useSPCSelector(
    current => ({
      selectedMaterial:  current.selectedMaterial,
      selectedMIC:       current.selectedMIC,
      selectedPlant:     current.selectedPlant,
      dateFrom:          current.dateFrom,
      dateTo:            current.dateTo,
      excludedIndices:   current.excludedIndices,
      exclusionDialog:   current.exclusionDialog,
      exclusionAudit:    current.exclusionAudit,
      chartTypeOverride: current.chartTypeOverride,
      excludeOutliers:   current.excludeOutliers,
      limitsMode:        current.limitsMode,
      roleMode:          current.roleMode,
      ruleSet:           current.ruleSet,
      stratifyBy:        current.stratifyBy,
    }),
    shallowEqual,
  )
  const {
    selectedMaterial, selectedMIC, selectedPlant, dateFrom, dateTo,
    excludedIndices, exclusionDialog, limitsMode,
  } = state
  const ctrl = useControlChartsController()
  const dq = useDataQuality(
    selectedMaterial?.material_id ?? null,
    selectedMIC?.mic_id           ?? null,
    selectedPlant?.plant_id       ?? null,
    dateFrom ?? null,
    dateTo   ?? null,
    selectedMIC?.operation_id     ?? null,
  )
  const excludedPanelRef = useRef<HTMLDivElement>(null)
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>(DEFAULT_VISIBLE_PANELS)
  const [actionNote, setActionNote]       = useState<string | null>(null)

  useEffect(() => {
    setActionNote(null)
  }, [selectedMIC?.mic_id, ctrl.attrChartType, ctrl.effectiveChartType])

  useEffect(() => {
    if (state.roleMode === 'operator') {
      setVisiblePanels(cur => cur.filter(id => id === 'primary'))
    }
  }, [state.roleMode])

  const togglePanel = (id: PanelId) =>
    setVisiblePanels(cur => cur.includes(id) ? cur.filter(p => p !== id) : [...cur, id])
  const isVisible = (id: PanelId) => visiblePanels.includes(id)

  const exportPayload = {
    export_type:  'excel',
    export_scope: ctrl.isAttributeChart ? 'attribute_chart' : 'chart_data',
    material_id:  selectedMaterial?.material_id ?? null,
    mic_id:       selectedMIC?.mic_id           ?? null,
    plant_id:     selectedPlant?.plant_id       ?? null,
    operation_id: selectedMIC?.operation_id     ?? null,
    chart_type:   ctrl.isAttributeChart ? ctrl.attrChartType : ctrl.effectiveChartType,
    date_from:    dateFrom || null,
    date_to:      dateTo   || null,
  }

  const availablePanels = useMemo<Array<{ id: PanelId; label: string; description: string; disabled?: boolean }>>(() => [
    { id: 'primary',        label: 'Primary chart',    description: 'Main control chart with live signals and limits.'                                                            },
    { id: 'capability',     label: 'Capability panel', description: 'Capability metrics and spec interpretation.',   disabled: ctrl.isAttributeChart || state.roleMode === 'operator' },
    { id: 'signals',        label: 'Signal queue',     description: 'Ordered rule violations and supporting evidence.', disabled: ctrl.isAttributeChart || state.roleMode === 'operator' },
    { id: 'trend',          label: 'Capability trend', description: 'Rolling capability storyline over time.',       disabled: ctrl.isAttributeChart || state.roleMode === 'operator' },
    { id: 'exclusions',     label: 'Exclusions',       description: 'Audited exclusions and restore actions.',       disabled: ctrl.isAttributeChart || state.roleMode === 'operator' },
    { id: 'stratification', label: 'Stratification',   description: 'Split the chart into comparison strata.',      disabled: ctrl.stratumSections.length === 0 || state.roleMode === 'operator' },
  ], [ctrl.isAttributeChart, ctrl.stratumSections.length, state.roleMode])

  const primarySubtitle = ctrl.isAttributeChart
    ? `${ctrl.chartFamilyLabel} · ${selectedMaterial?.material_name ?? selectedMaterial?.material_id ?? ''}`
    : `${ctrl.chartFamilyLabel}${ctrl.stratifyLabel ? ` · Stratified by ${ctrl.stratifyLabel}` : ''}`

  const handleExcludeAssist = () =>
    setActionNote(ctrl.isAttributeChart
      ? 'Exclusion request recorded. Attribute-chart point removal will connect to the backend audit workflow in the next iteration.'
      : 'Exclusion request recorded. Click any chart point to exclude or restore it, and the audit trail will carry the justification you just entered.',
    )

  const handleAnnotate = () =>
    setActionNote('Annotation threads are staged for the next iteration. For now, use the exclusion audit trail and exported evidence package.')

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!selectedMaterial) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>No scope selected</div>
        <div>Select a material and characteristic above to view control charts.</div>
      </div>
    )
  }

  if (!selectedMIC) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>
          Material: {selectedMaterial.material_name ?? selectedMaterial.material_id}
        </div>
        <div>Now select a characteristic (MIC) to view its control chart.</div>
      </div>
    )
  }

  if (ctrl.loading || (ctrl.analyticsLoading && (ctrl.points.length === 0 || (ctrl.isQuantitative && !ctrl.spc)))) {
    return (
      <div aria-live="polite" aria-busy="true" style={{ padding: 20 }}>
        <ChartSkeleton height="600px" />
      </div>
    )
  }

  if (ctrl.error) {
    return (
      <div style={{
        margin: 20, padding: '14px 18px', borderRadius: 10,
        background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
        color: 'var(--status-risk)', fontSize: 13,
      }}>
        <strong>Failed to load chart data</strong> — {String(ctrl.error)}
      </div>
    )
  }

  if (!ctrl.points.length) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>
          No {ctrl.isAttributeChart ? 'attribute' : 'quantitative'} data found for {selectedMIC.mic_name ?? selectedMIC.mic_id}
        </div>
        <div>Try widening the date range or selecting a different characteristic.</div>
      </div>
    )
  }

  if (ctrl.isQuantitative && !ctrl.spc) {
    if (ctrl.analyticsError) {
      return (
        <div style={{
          margin: 20, padding: '14px 18px', borderRadius: 10,
          background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
          color: 'var(--status-risk)', fontSize: 13,
        }}>
          <strong>Failed to compute SPC analytics</strong> — {ctrl.analyticsError}
        </div>
      )
    }
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>Insufficient data</div>
        <div>Minimum 2 points required to compute control limits.</div>
      </div>
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────

  return (
    <div aria-live="polite" aria-busy="false" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <ChartSummaryBar
        title={selectedMIC.mic_name || selectedMIC.mic_id}
        materialName={selectedMaterial.material_name || selectedMaterial.material_id}
        inspectionMethod={selectedMIC.inspection_method}
        chartFamilyLabel={ctrl.chartFamilyLabel}
        totalSignals={ctrl.totalSignals}
        exclusionCount={ctrl.exclusionCount}
        capabilityHeadline={ctrl.capabilityHeadline?.value ?? null}
        capabilityHeadlineLabel={ctrl.capabilityHeadline?.label ?? null}
        stratifyLabel={ctrl.stratifyLabel}
        quantNormality={ctrl.isAttributeChart ? null : ctrl.quantNormality}
        ruleSet={state.ruleSet}
        actionRail={null}
        lockedLimits={ctrl.lockedLimits}
        limitsMode={limitsMode}
        limitsSourceLabel={ctrl.limitsSourceLabel}
        onExclusionClick={
          ctrl.exclusionCount > 0
            ? () => excludedPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            : undefined
        }
      />

      <ChartInfoBanners
        lockedLimitsError={ctrl.lockedLimitsError}
        lockedLimitsWarning={ctrl.lockedLimitsWarning}
        limitsSourceDetail={ctrl.limitsSourceDetail}
        limitsSourceTone={ctrl.limitsSourceTone}
        exclusionsError={ctrl.exclusionsError}
        exclusionsLoading={ctrl.exclusionsLoading}
        dataTruncated={ctrl.dataTruncated}
        exclusionAudit={state.exclusionAudit}
        specDrift={ctrl.specDrift}
        autocorrelation={ctrl.spc?.autocorrelation ?? null}
      />

      {ctrl.analyticsError && (
        <div style={{
          padding: '12px 16px', borderRadius: 8,
          background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
          color: 'var(--status-risk)', fontSize: 13,
        }}>
          <strong>Analytics refresh failed</strong> — {ctrl.analyticsError}
        </div>
      )}

      {ctrl.hydrating && (
        <div className="card" style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-3)' }}>
          Loading more chart history…
        </div>
      )}

      {/*
       * Two-column layout: charts left (1fr) + sticky rail right (320px)
       */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

        {/* ── Chart panels ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Primary control chart */}
          {isVisible('primary') && (
            <ChartCard
              title={selectedMIC.mic_name || selectedMIC.mic_id}
              subtitle={primarySubtitle}
              cpk={ctrl.capabilityHeadline?.value ?? null}
              note={actionNote}
              onExcludePoint={handleExcludeAssist}
              onExport={() => ctrl.exportData(exportPayload)}
              onAnnotate={handleAnnotate}
              exportLabel="Export Data"
            >
              {ctrl.isAttributeChart ? (
                <Suspense fallback={<ChartSkeleton height="420px" />}>
                  {ctrl.attrChartType === 'p_chart'  && <PChart  points={ctrl.attrPoints}  embedded />}
                  {ctrl.attrChartType === 'c_chart'  && <CChart  points={ctrl.countPoints} embedded />}
                  {ctrl.attrChartType === 'u_chart'  && <UChart  points={ctrl.countPoints} embedded />}
                  {ctrl.attrChartType === 'np_chart' && <NPChart points={ctrl.countPoints} embedded />}
                </Suspense>
              ) : (
                ctrl.spc
                  ? renderQuantitativeChart(ctrl.spc, ctrl.externalLimits, excludedIndices, ctrl.handlePointClick)
                  : null
              )}
            </ChartCard>
          )}

          {/* Quantitative-only lower panels */}
          {!ctrl.isAttributeChart && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Capability + Exclusions */}
              {(isVisible('capability') || isVisible('exclusions')) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  {isVisible('capability') && (
                    <Suspense fallback={<ChartSkeleton height="160px" />}>
                      <CapabilityPanel spc={ctrl.spc} />
                    </Suspense>
                  )}
                  {isVisible('exclusions') && (
                    <div ref={excludedPanelRef}>
                      <Suspense fallback={<ChartSkeleton height="160px" />}>
                        <ExcludedPointsPanel
                          snapshot={ctrl.exclusionsSnapshot ?? state.exclusionAudit}
                          currentPoints={ctrl.currentExcludedPoints}
                          onRestorePoint={ctrl.handleRestorePoint}
                          onRestoreAll={ctrl.handleRestoreAll}
                          saving={ctrl.exclusionsSaving}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}

              {/* Interpretation guide shown when both capability panels are hidden */}
              {!isVisible('capability') && !isVisible('exclusions') && (
                <div className="card" style={{ padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    Interpretation guide
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)' }}>
                    Establish stability first, then interpret capability. Signals point to assignable causes, while
                    exclusions and locked limits preserve the audit trail for this chart scope.
                  </p>
                </div>
              )}

              {/* Data quality — full width */}
              {isVisible('dataQuality') && (
                <Suspense fallback={<ChartSkeleton height="140px" />}>
                  <DataQualityPanel
                    summary={dq.summary}
                    loading={dq.loading}
                    error={dq.error}
                  />
                </Suspense>
              )}

              {/* Signals + Capability Trend */}
              {(isVisible('signals') || isVisible('trend')) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  {isVisible('signals') && (
                    <Suspense fallback={<ChartSkeleton height="160px" />}>
                      <SignalsPanel
                        signals={ctrl.spc?.signals}
                        mrSignals={ctrl.spc?.mrSignals}
                        indexedPoints={ctrl.spc?.indexedPoints}
                        ruleSet={state.ruleSet}
                      />
                    </Suspense>
                  )}
                  {isVisible('trend') && (
                    <ChartCard
                      title="Capability Storyline"
                      subtitle={`Rolling window ${ctrl.rollingWindowSize} observations`}
                      cpk={ctrl.capabilityHeadline?.value ?? null}
                      onExport={() => ctrl.exportData(exportPayload)}
                      onAnnotate={handleAnnotate}
                      exportLabel="Export Data"
                    >
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-3)' }}>
                          Window
                          <input
                            type="number"
                            min={5}
                            max={Math.max(5, ctrl.spc?.sorted?.length ?? 5)}
                            value={ctrl.rollingWindowSize}
                            className="field"
                            style={{ width: '5rem' }}
                            onChange={e => {
                              const next = Number(e.target.value)
                              if (Number.isFinite(next) && next >= 5) ctrl.setRollingWindowSize(next)
                            }}
                          />
                        </label>
                      </div>
                      <Suspense fallback={<ChartSkeleton height="220px" />}>
                        <CapabilityTrendChart trendData={ctrl.trendData} windowSize={ctrl.rollingWindowSize} />
                      </Suspense>
                    </ChartCard>
                  )}
                </div>
              )}

              {/* Stratification panels */}
              {isVisible('stratification') && ctrl.stratumSections.length > 0 && (
                <StratificationPanel
                  micLabel={selectedMIC.mic_name || selectedMIC.mic_id}
                  stratifyBy={state.stratifyBy ?? ''}
                  sections={ctrl.stratumSections}
                  renderChart={spc => renderQuantitativeChart(spc, null, new Set<number>())}
                  renderSignals={spc => (
                    <Suspense fallback={<ChartSkeleton height="160px" />}>
                      <SignalsPanel signals={spc.signals} mrSignals={spc.mrSignals} indexedPoints={spc.indexedPoints} ruleSet={state.ruleSet} />
                    </Suspense>
                  )}
                  renderCapability={spc => (
                    <Suspense fallback={<ChartSkeleton height="160px" />}>
                      <CapabilityPanel spc={spc} />
                    </Suspense>
                  )}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Sticky right rail ────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 'calc(var(--header-h) + var(--filter-h) + 8px)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <PanelSelector
            availablePanels={availablePanels}
            visiblePanels={visiblePanels}
            onToggle={togglePanel}
            stratifyLabel={ctrl.stratifyLabel}
          />

          {state.roleMode === 'engineer' ? (
            <ChartSettingsRail
              ruleSet={state.ruleSet}
              onRuleSetChange={v => dispatch({ type: 'SET_RULE_SET', payload: v })}
              selectedMicChartType={selectedMIC.chart_type}
              chartTypeOverride={state.chartTypeOverride}
              onChartTypeOverride={v => dispatch({ type: 'SET_CHART_TYPE_OVERRIDE', payload: v })}
              attrChartType={ctrl.attrChartType}
              onAttrChartTypeChange={ctrl.setAttrChartType}
              effectiveChartType={ctrl.effectiveChartType}
              ewmaLambda={ctrl.ewmaLambda}       onEwmaLambdaChange={ctrl.setEwmaLambda}
              ewmaL={ctrl.ewmaL}                 onEwmaLChange={ctrl.setEwmaL}
              cusumK={ctrl.cusumK}               onCusumKChange={ctrl.setCusumK}
              cusumH={ctrl.cusumH}               onCusumHChange={ctrl.setCusumH}
              isAttributeChart={ctrl.isAttributeChart}
              lockedLimits={ctrl.lockedLimits}
              limitsMode={limitsMode}
              onLimitsMode={v => dispatch({ type: 'SET_LIMITS_MODE', payload: v })}
              canLockLimits={ctrl.canLockLimits}
              onLockLimits={ctrl.handleLockLimits}
              onDeleteLock={ctrl.handleDeleteLock}
              quantPoints={ctrl.quantPoints}
              excludeOutliers={state.excludeOutliers}
              onToggleExcludeOutliers={() => dispatch({ type: 'TOGGLE_EXCLUDE_OUTLIERS' })}
              exclusionCount={ctrl.exclusionCount}
              exclusionsSaving={ctrl.exclusionsSaving}
              onRestoreAll={ctrl.handleRestoreAll}
              canAutoClean={(ctrl.spc?.indexedPoints?.length ?? 0) > 0}
              onAutoClean={ctrl.handleAutoClean}
            />
          ) : (
            <div className="card" style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-3)' }}>
              Operator mode keeps this view focused on live monitoring. Switch back to Engineer
              mode in the header to unlock rule tuning, limit controls, and the audit panels.
            </div>
          )}
        </div>
      </div>

      {/* Auto-clean result */}
      {ctrl.autoCleanLog && (
        <AutoCleanLog log={ctrl.autoCleanLog} onDismiss={() => ctrl.setAutoCleanLog(null)} />
      )}

      {/* Exclusion justification modal */}
      <Suspense fallback={null}>
        <ExclusionJustificationModal
          dialog={exclusionDialog}
          saving={ctrl.exclusionsSaving}
          onCancel={ctrl.closeDialog}
          onSubmit={ctrl.handleDialogSubmit}
        />
      </Suspense>
    </div>
  )
}
