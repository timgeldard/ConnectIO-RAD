import { useState, type ReactNode } from 'react'
import type { ChartDataPoint, LockedLimits } from '../types'

export type AttributeChartType = 'p_chart' | 'np_chart' | 'c_chart' | 'u_chart'
export type QuantChartType = 'imr' | 'xbar_r' | 'xbar_s' | 'ewma' | 'cusum'

function ChartTypeToggle({
  chartType,
  override,
  onOverride,
}: {
  chartType?: string | null
  override: QuantChartType | null
  onOverride: (value: QuantChartType | null) => void
}) {
  const effectiveType = override ?? chartType ?? 'imr'
  const options: Array<{ value: QuantChartType; label: string }> = [
    { value: 'imr',    label: 'I-MR'  },
    { value: 'xbar_r', label: 'X̄-R'  },
    { value: 'xbar_s', label: 'X̄-S'  },
    { value: 'ewma',   label: 'EWMA'  },
    { value: 'cusum',  label: 'CUSUM' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="eyebrow">Chart type</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            className={`btn btn-sm ${effectiveType === opt.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onOverride(opt.value === chartType ? null : opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        {override && (
          <button className="btn btn-ghost btn-sm" onClick={() => onOverride(null)}>
            Reset to auto
          </button>
        )}
        {chartType && !override && (
          <span className="chip" style={{ fontSize: 11 }}>auto-detected</span>
        )}
      </div>
    </div>
  )
}

function TimeWeightedControls({
  chartType,
  ewmaLambda, ewmaL, cusumK, cusumH,
  onEwmaLambdaChange, onEwmaLChange, onCusumKChange, onCusumHChange,
}: {
  chartType: QuantChartType | null
  ewmaLambda: number
  ewmaL: number
  cusumK: number
  cusumH: number
  onEwmaLambdaChange: (value: number) => void
  onEwmaLChange: (value: number) => void
  onCusumKChange: (value: number) => void
  onCusumHChange: (value: number) => void
}) {
  if (chartType !== 'ewma' && chartType !== 'cusum') return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="eyebrow">Time-weighted settings</div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}>
        {chartType === 'ewma' ? (
          <>
            <div>
              <label className="field-label" htmlFor="spc-ewma-lambda">λ</label>
              <input
                id="spc-ewma-lambda" className="field" type="number"
                value={ewmaLambda}
                onChange={e => onEwmaLambdaChange(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="spc-ewma-l">L</label>
              <input
                id="spc-ewma-l" className="field" type="number"
                value={ewmaL}
                onChange={e => onEwmaLChange(Number(e.target.value))}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor="spc-cusum-k">k</label>
              <input
                id="spc-cusum-k" className="field" type="number"
                value={cusumK}
                onChange={e => onCusumKChange(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="spc-cusum-h">h</label>
              <input
                id="spc-cusum-h" className="field" type="number"
                value={cusumH}
                onChange={e => onCusumHChange(Number(e.target.value))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AttributeChartTypeToggle({
  attrChartType,
  onSet,
}: {
  attrChartType: AttributeChartType
  onSet: (value: AttributeChartType) => void
}) {
  const options: Array<{ type: AttributeChartType; label: string; title: string }> = [
    { type: 'p_chart',  label: 'P',  title: 'Proportion nonconforming (variable sample size)' },
    { type: 'np_chart', label: 'NP', title: 'Number nonconforming (constant sample size)'     },
    { type: 'c_chart',  label: 'C',  title: 'Count of defects per unit (constant area of opportunity)' },
    { type: 'u_chart',  label: 'U',  title: 'Defects per unit (variable area of opportunity)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="eyebrow">Chart type</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(({ type, label, title }) => (
          <button
            key={type}
            className={`btn btn-sm ${attrChartType === type ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSet(type)}
            title={title}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RuleSetToggle({
  ruleSet,
  onSet,
}: {
  ruleSet: 'weco' | 'nelson'
  onSet: (value: 'weco' | 'nelson') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="eyebrow">Rule set</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          className={`btn btn-sm ${ruleSet === 'weco' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onSet('weco')}
          title="Western Electric rules (4 tests)"
        >
          WECO
        </button>
        <button
          className={`btn btn-sm ${ruleSet === 'nelson' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onSet('nelson')}
          title="Nelson rules (8 tests)"
        >
          Nelson
        </button>
      </div>
    </div>
  )
}

interface ChartSettingsRailProps {
  ruleSet: 'weco' | 'nelson'
  onRuleSetChange: (value: 'weco' | 'nelson') => void
  selectedMicChartType?: string | null
  chartTypeOverride: QuantChartType | null
  onChartTypeOverride: (value: QuantChartType | null) => void
  attrChartType: AttributeChartType
  onAttrChartTypeChange: (value: AttributeChartType) => void
  effectiveChartType: QuantChartType | null
  ewmaLambda: number
  onEwmaLambdaChange: (value: number) => void
  ewmaL: number
  onEwmaLChange: (value: number) => void
  cusumK: number
  onCusumKChange: (value: number) => void
  cusumH: number
  onCusumHChange: (value: number) => void
  isAttributeChart: boolean
  lockedLimits: LockedLimits | null
  limitsMode: 'live' | 'locked'
  onLimitsMode: (value: 'live' | 'locked') => void
  canLockLimits: boolean
  onLockLimits: () => void
  onDeleteLock: () => void
  quantPoints: ChartDataPoint[]
  excludeOutliers: boolean
  onToggleExcludeOutliers: () => void
  exclusionCount: number
  exclusionsSaving: boolean
  onRestoreAll: () => void
  canAutoClean: boolean
  onAutoClean: () => void
  extraContent?: ReactNode
}

export default function ChartSettingsRail({
  ruleSet,
  onRuleSetChange,
  selectedMicChartType,
  chartTypeOverride,
  onChartTypeOverride,
  attrChartType,
  onAttrChartTypeChange,
  effectiveChartType,
  ewmaLambda, onEwmaLambdaChange,
  ewmaL, onEwmaLChange,
  cusumK, onCusumKChange,
  cusumH, onCusumHChange,
  isAttributeChart,
  lockedLimits,
  limitsMode, onLimitsMode,
  canLockLimits,
  onLockLimits, onDeleteLock,
  quantPoints,
  excludeOutliers, onToggleExcludeOutliers,
  exclusionCount, exclusionsSaving,
  onRestoreAll,
  canAutoClean, onAutoClean,
  extraContent,
}: ChartSettingsRailProps) {
  const outlierCount = quantPoints.filter(point => point.is_outlier).length
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const hasAdvancedContent = !isAttributeChart && (
    outlierCount > 0 || lockedLimits != null || canLockLimits
  )

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="eyebrow">Analysis controls</div>

      {isAttributeChart ? (
        <AttributeChartTypeToggle attrChartType={attrChartType} onSet={onAttrChartTypeChange} />
      ) : (
        <ChartTypeToggle
          chartType={selectedMicChartType}
          override={chartTypeOverride}
          onOverride={onChartTypeOverride}
        />
      )}

      {!isAttributeChart && (exclusionCount > 0 || canAutoClean) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exclusionCount > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={exclusionsSaving}
              onClick={onRestoreAll}
            >
              Clear {exclusionCount} exclusion{exclusionCount !== 1 ? 's' : ''}
            </button>
          )}
          {canAutoClean && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={exclusionsSaving}
              onClick={onAutoClean}
              title="Iteratively remove Rule 1 OOC points to establish Phase I baseline limits"
            >
              Auto-clean Phase I
            </button>
          )}
        </div>
      )}

      {!isAttributeChart && (
        <TimeWeightedControls
          chartType={effectiveChartType}
          ewmaLambda={ewmaLambda} onEwmaLambdaChange={onEwmaLambdaChange}
          ewmaL={ewmaL} onEwmaLChange={onEwmaLChange}
          cusumK={cusumK} onCusumKChange={onCusumKChange}
          cusumH={cusumH} onCusumHChange={onCusumHChange}
        />
      )}

      {/* Advanced settings toggle */}
      <div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'space-between' }}
          onClick={() => setAdvancedOpen(v => !v)}
        >
          <span>{hasAdvancedContent ? 'Advanced settings' : 'Advanced settings (limited)'}</span>
          <span style={{ fontSize: 10 }}>{advancedOpen ? '▲' : '▼'}</span>
        </button>

        {advancedOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RuleSetToggle ruleSet={ruleSet} onSet={onRuleSetChange} />

            {!isAttributeChart && outlierCount > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-1)' }}>
                <input
                  type="checkbox"
                  checked={excludeOutliers}
                  onChange={onToggleExcludeOutliers}
                  style={{ accentColor: 'var(--valentia-slate)', width: 14, height: 14, cursor: 'pointer' }}
                />
                Exclude outliers ({outlierCount})
              </label>
            )}

            {!isAttributeChart && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lockedLimits && (
                  <button
                    className={`btn btn-sm ${limitsMode === 'locked' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => onLimitsMode(limitsMode === 'locked' ? 'live' : 'locked')}
                    title={`Locked ${lockedLimits.locked_at?.substring(0, 10) ?? ''} by ${lockedLimits.locked_by ?? 'unknown'}`}
                  >
                    {limitsMode === 'locked' ? 'Locked Limits' : 'Use Locked Limits'}
                  </button>
                )}
                {canLockLimits && limitsMode === 'live' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onLockLimits}
                    title="Lock current control limits for Phase II monitoring"
                  >
                    Lock Limits
                  </button>
                )}
                {lockedLimits && limitsMode === 'locked' && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={onDeleteLock}
                    title="Remove locked limits"
                  >
                    Delete Lock
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {extraContent}
    </div>
  )
}
