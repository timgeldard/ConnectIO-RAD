import { useMemo, useState } from 'react'
import '../charts/ensureEChartsTheme'
import { shallowEqual, useSPCSelector } from '../SPCContext'
import ModuleEmptyState from '../components/ModuleEmptyState'
import FieldHelp from '../components/FieldHelp'
import InfoBanner from '../components/InfoBanner'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useCompareScorecard } from '../hooks/useCompareScorecard'
import GroupedBarChart from './GroupedBarChart'

const TILE: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1.25rem' }
const EYEBROW: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }

export default function CompareView() {
  const state = useSPCSelector(
    current => ({
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
      selectedPlant: current.selectedPlant,
    }),
    shallowEqual,
  )
  const [materialInputs, setMaterialInputs] = useState<string[]>(['', ''])

  const validIds = useMemo(
    () => Array.from(new Set(materialInputs.map((s) => s.trim()).filter((s) => s.length > 0))),
    [materialInputs],
  )

  const { result, loading, error } = useCompareScorecard(
    validIds.length >= 2 ? validIds : null,
    state.dateFrom,
    state.dateTo,
    state.selectedPlant?.plant_id,
  )

  const addMaterial = (): void => {
    if (materialInputs.length < 3) setMaterialInputs((v) => [...v, ''])
  }

  const removeMaterial = (i: number): void => {
    setMaterialInputs((v) => v.filter((_, idx) => idx !== i))
  }

  const updateMaterial = (i: number, val: string): void => {
    setMaterialInputs((v) => v.map((x, idx) => (idx === i ? val : x)))
  }

  const hasNoCommonMICs = result && result.common_mics.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={TILE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={EYEBROW}>Cross-material analysis</div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Multi-Material Capability Comparison
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
            Compare Cpk across common characteristics for 2–3 materials using the same selected plant and date scope.
            Results show only characteristics measured on all entered materials.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 5fr)' }}>
        <div style={TILE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={EYEBROW}>Materials to compare</div>
            {materialInputs.map((val, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={`compare-mat-${i}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)' }}>
                    Material {i + 1}
                  </label>
                  <input
                    id={`compare-mat-${i}`}
                    className="field"
                    placeholder="e.g. RM-12345"
                    value={val}
                    onChange={(e) => updateMaterial(i, e.target.value)}
                  />
                  <FieldHelp id={`compare-mat-${i}-help`}>
                    {i === 0
                      ? 'Enter the SAP / ERP material ID exactly as it appears in your system.'
                      : 'Must share at least one characteristic (MIC) with Material 1 to generate comparison data.'}
                  </FieldHelp>
                </div>
                {materialInputs.length > 2 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => removeMaterial(i)}
                    aria-label={`Remove Material ${i + 1}`}
                    style={{ marginTop: '1.25rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {materialInputs.length < 3 && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={addMaterial} style={{ width: 'fit-content' }}>
                Add material
              </button>
            )}
            {validIds.length === 1 && (
              <FieldHelp>Enter a second material ID to start the comparison.</FieldHelp>
            )}
          </div>
        </div>

        <div style={TILE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={EYEBROW}>How to use this view</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
              Best for process transfers, supplier changes, or recipe alternatives, where you want to check
              whether two materials behave consistently across shared quality characteristics.
            </p>
            <ol aria-label="Steps to compare materials" style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-3)' }}>
              <li>Enter 2–3 material IDs above.</li>
              <li>Set plant and date scope in the filter bar.</li>
              <li>Comparison loads automatically once at least 2 valid IDs are entered.</li>
              <li>Look for characteristics where one material has materially lower Cpk than the others.</li>
            </ol>
            <InfoBanner variant="info">
              Only characteristics measured on all entered materials are shown. If the chart is empty, check that all materials share at least one common MIC.
            </InfoBanner>
          </div>
        </div>
      </div>

      {validIds.length >= 2 && loading && (
        <LoadingSkeleton message="Loading comparison data (may take a few seconds)…" />
      )}

      {error && <InfoBanner variant="error">{error}</InfoBanner>}

      {hasNoCommonMICs && (
        <ModuleEmptyState
          title="No common characteristics found"
          description="The selected materials share no common MICs in the chosen plant and date window. Try a different plant, a wider date range, or verify the material IDs are correct."
        />
      )}

      {result && result.common_mics.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {result.materials.map((m) => (
              <span key={m.material_id} className="chip">
                {m.material_name ?? m.material_id}: {m.scorecard.length} characteristics
              </span>
            ))}
            <span className="chip chip-ok">{result.common_mics.length} common</span>
          </div>
          <GroupedBarChart materials={result.materials} commonMics={result.common_mics} />
        </>
      )}

      {!result && !loading && !error && validIds.length < 2 && (
        <ModuleEmptyState
          icon="⇄"
          title="Enter two or more materials to compare"
          description="Use the inputs above to load a side-by-side Cpk comparison for shared characteristics."
        />
      )}
    </div>
  )
}
