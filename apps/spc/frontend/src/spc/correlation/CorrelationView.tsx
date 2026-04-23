import { useState } from 'react'
import '../charts/ensureEChartsTheme'
import { shallowEqual, useSPCSelector } from '../SPCContext'
import FieldHelp from '../components/FieldHelp'
import InfoBanner from '../components/InfoBanner'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ModuleEmptyState from '../components/ModuleEmptyState'
import CorrelationMatrix from '../charts/CorrelationMatrix'
import CorrelationScatter from '../charts/CorrelationScatter'
import { useCorrelation } from '../hooks/useCorrelation'
import { useCorrelationScatter } from '../hooks/useCorrelationScatter'
import type { CorrelationPair } from '../types'

interface SelectedCorrelationPair {
  micAId: string
  micBId: string
  micAName: string
  micBName: string
}

const TILE: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1.25rem' }
const EYEBROW: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }

function DriverRanking({ pairs, n = 5 }: { pairs: CorrelationPair[]; n?: number }) {
  type RankedPair = CorrelationPair & { _r: number }
  const top: RankedPair[] = pairs
    .map((p) => ({ ...p, _r: p.pearson_r ?? null }))
    .filter((p): p is RankedPair => p._r != null)
    .sort((a, b) => Math.abs(b._r) - Math.abs(a._r))
    .slice(0, n)

  if (!top.length) return null

  return (
    <div style={TILE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={EYEBROW}>Strongest relationships (top {top.length})</div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>
          High |r| values indicate a linear relationship. Click the corresponding cell in the matrix to validate with a scatter plot.
        </p>
        <ol aria-label="Top correlated characteristic pairs" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.25rem' }}>
          {top.map((p, i) => {
            const r = p._r
            const isPositive = r >= 0
            const absR = Math.abs(r)
            const strength = absR >= 0.7 ? 'strong' : absR >= 0.4 ? 'moderate' : 'weak'
            const color = absR >= 0.7 ? '#d9480f' : absR >= 0.4 ? '#00539a' : '#697077'
            return (
              <li key={`${p.mic_a_id}-${p.mic_b_id}`} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ width: '1rem', flexShrink: 0, textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-3)' }}>{i + 1}.</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-1)' }}>
                  {p.mic_a_name ?? p.mic_a_id} <span style={{ color: 'var(--text-3)' }}>↔</span> {p.mic_b_name ?? p.mic_b_id}
                </span>
                <span style={{ position: 'relative', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color }}>
                  r = {r.toFixed(3)}
                  <span
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      padding: 0,
                      margin: '-1px',
                      overflow: 'hidden',
                      clip: 'rect(0, 0, 0, 0)',
                      whiteSpace: 'nowrap',
                      border: 0,
                    }}
                  >
                    ({isPositive ? 'positive' : 'negative'} {strength} correlation)
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default function CorrelationView() {
  const state = useSPCSelector(
    current => ({
      selectedMaterial: current.selectedMaterial,
      selectedPlant: current.selectedPlant,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    }),
    shallowEqual,
  )
  const { result, loading, error, fetchCorrelation } = useCorrelation()
  const { result: scatterResult, loading: scatterLoading, error: scatterError, fetchScatter } = useCorrelationScatter()
  const [minBatches, setMinBatches] = useState(10)
  const [selectedPair, setSelectedPair] = useState<SelectedCorrelationPair | null>(null)

  const handleRun = (): void => {
    if (!state.selectedMaterial) return
    setSelectedPair(null)
    fetchCorrelation({
      materialId: state.selectedMaterial.material_id,
      plantId: state.selectedPlant?.plant_id,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      minBatches,
    })
  }

  const handleCellClick = (micAId: string, micBId: string, micAName: string, micBName: string): void => {
    if (!state.selectedMaterial) return
    setSelectedPair({ micAId, micBId, micAName, micBName })
    fetchScatter({
      materialId: state.selectedMaterial.material_id,
      micAId,
      micBId,
      plantId: state.selectedPlant?.plant_id,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
    })
  }

  if (!state.selectedMaterial) {
    return (
      <ModuleEmptyState
        icon="〜"
        title="Select a material to explore correlations"
        description="Pairwise Pearson correlation across all characteristics. Use the filter bar above to select a material, then run the analysis."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={TILE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={EYEBROW}>Relationship analysis</div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Correlation Explorer
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
            Pairwise Pearson correlation between all characteristics for{' '}
            <strong>{state.selectedMaterial.material_name ?? state.selectedMaterial.material_id}</strong>.
            Click a matrix cell to validate whether a relationship is operationally meaningful.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 5fr)' }}>
        <div style={TILE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={EYEBROW}>Analysis controls</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '8rem' }}>
                <label htmlFor="corr-min-batches" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)' }}>Min batches</label>
                <input
                  id="corr-min-batches"
                  className="field"
                  type="number"
                  value={String(minBatches)}
                  onChange={(e) => setMinBatches(Math.max(5, Math.min(100, Number(e.target.value) || 5)))}
                />
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleRun}
                disabled={loading}
                aria-label={`Run correlation analysis for ${state.selectedMaterial.material_name ?? state.selectedMaterial.material_id}`}
              >
                {loading ? 'Computing…' : 'Run Correlation'}
              </button>
            </div>
            <FieldHelp id="corr-min-batches-help">
              Minimum number of shared batch observations required to include a pair. Higher values improve
              statistical reliability but reduce the number of pairs shown.
            </FieldHelp>
            {(state.dateFrom || state.dateTo) && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>
                Window: {state.dateFrom || '—'} → {state.dateTo || 'today'}
              </p>
            )}
          </div>
        </div>

        <div style={TILE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={EYEBROW}>Interpretation guardrails</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
              Correlation is a directional clue, not proof of causation. A strong r value may reflect a common
              trend, a confounding variable, or true process coupling. Use the scatter plot to distinguish.
            </p>
            <div style={{ display: 'grid', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
              <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: '#d9480f' }}>|r| ≥ 0.70</span> — strong, worth investigating</p>
              <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: '#00539a' }}>0.40 ≤ |r| &lt; 0.70</span> — moderate signal</p>
              <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: '#697077' }}>|r| &lt; 0.40</span> — weak, usually noise</p>
            </div>
          </div>
        </div>
      </div>

      {loading && <LoadingSkeleton message="Computing correlations…" />}

      {error && <InfoBanner variant="error">{error}</InfoBanner>}

      {result && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="chip">{result.pair_count} pairs</span>
            <span className="chip">{result.mics.length} characteristics</span>
            <span className="chip">min {minBatches} batches</span>
            {result.pair_count >= 500 && <span className="chip">showing top 500 by |r|</span>}
          </div>

          {result.mics.length > 30 && (
            <InfoBanner variant="warn">
              More than 30 characteristics detected. Consider narrowing the date range or increasing min batches
              to focus on the most data-rich pairs.
            </InfoBanner>
          )}

          <DriverRanking pairs={result.pairs} />

          <InfoBanner variant="info">
            Click any cell in the matrix below to open a scatter plot for that pair.
          </InfoBanner>

          <CorrelationMatrix
            pairs={result.pairs}
            mics={result.mics}
            onCellClick={handleCellClick}
          />

          {selectedPair && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  Scatter: {selectedPair.micAName} ↔ {selectedPair.micBName}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  does the relationship hold across the batch range?
                </span>
              </div>
              <CorrelationScatter
                result={scatterResult}
                loading={scatterLoading}
                error={scatterError}
              />
            </>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <ModuleEmptyState
          title="Run the analysis to explore relationships"
          description="Adjust the min-batches threshold if needed, then press Run Correlation."
        />
      )}
    </div>
  )
}
