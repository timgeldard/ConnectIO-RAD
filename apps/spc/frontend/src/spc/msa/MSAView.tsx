import { useState } from 'react'
import { shallowEqual, useSPCSelector } from '../SPCContext'
import { useMSACalculate } from '../hooks/useMSACalculate'
import { useMSASave } from '../hooks/useMSASave'
import type { MSAResult } from '../types'
import FieldHelp from '../components/FieldHelp'
import InfoBanner from '../components/InfoBanner'
import { grrStatusClass } from '../components/StatusPill'

type MSADataCube = Array<Array<Array<number | null>>>

function parseCSVData(text: string, nOperators: number, nParts: number, nReplicates: number): MSADataCube | null {
  const lines = text.trim().split(/\r?\n/).map(l => l.split(/[,\t]/).map(s => s.trim()))
  if (!lines.length) return null

  const data: MSADataCube = Array.from({ length: nOperators }, () =>
    Array.from({ length: nParts }, () => Array<number | null>(nReplicates).fill(null)),
  )

  if (lines[0].length >= 4) {
    const hasHeader = Number.isNaN(parseFloat(lines[0][3]))
    const rows = hasHeader ? lines.slice(1) : lines
    for (const row of rows) {
      const op = parseInt(row[0], 10) - 1
      const pt = parseInt(row[1], 10) - 1
      const rep = parseInt(row[2], 10) - 1
      const val = parseFloat(row[3])
      if (op >= 0 && op < nOperators && pt >= 0 && pt < nParts && rep >= 0 && rep < nReplicates) {
        data[op][pt][rep] = val
      }
    }
    return data
  }

  return null
}

interface GRRResultProps {
  result: MSAResult | null
  onSave: () => Promise<void>
  saving: boolean
  isPersistable: boolean
}

function GRRResult({ result, onSave, saving, isPersistable }: GRRResultProps) {
  if (!result) return null
  if (result.error) return <InfoBanner variant="error">{result.error}</InfoBanner>

  const {
    grrPct,
    grrPctTol,
    ndc,
    ev,
    av,
    grr,
    pv,
    tv,
    method,
    interactionVariation,
    interactionPValue,
    modelWarning,
    systemStabilityWarning,
  } = result
  const { colorStyle, verdict } = grrStatusClass(grrPct)

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', fontStyle: 'italic', color: 'var(--text-3)' }}>
          Method: <strong>{method === 'anova' ? 'ANOVA Gauge R&R' : 'Average & Range'}</strong>
          {method === 'anova' && interactionPValue != null && ` · interaction p = ${interactionPValue.toFixed(4)}`}
        </p>
        {modelWarning && <InfoBanner variant="warn">{modelWarning}</InfoBanner>}
        {systemStabilityWarning && <InfoBanner variant="warn">{systemStabilityWarning}</InfoBanner>}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem', fontSize: '1.125rem', fontWeight: 600, color: colorStyle }}>
          <span>{grrPct?.toFixed(1) ?? '—'}% GRR</span>
          <span>{verdict}</span>
          {grrPctTol != null && <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>({grrPctTol.toFixed(1)}% of tolerance)</span>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-1)' }}>
              <th style={{ textAlign: 'left', padding: '0.375rem 0', color: 'var(--text-3)', fontWeight: 600 }}>Source</th>
              <th style={{ textAlign: 'right', padding: '0.375rem 0', color: 'var(--text-3)', fontWeight: 600 }}>σ</th>
              <th style={{ textAlign: 'right', padding: '0.375rem 0', color: 'var(--text-3)', fontWeight: 600 }}>% Contribution</th>
            </tr>
          </thead>
          <tbody style={{ color: 'var(--text-1)' }}>
            {[
              { label: 'Repeatability (EV)', sigma: ev, pct: tv && tv > 0 && ev != null ? ((ev / tv) * 100).toFixed(1) : '—' },
              { label: 'Reproducibility (AV)', sigma: av, pct: tv && tv > 0 && av != null ? ((av / tv) * 100).toFixed(1) : '—' },
              ...(method === 'anova' ? [{ label: 'Op × Part Interaction', sigma: interactionVariation, pct: tv && tv > 0 ? (((interactionVariation ?? 0) / tv) * 100).toFixed(1) : '—' }] : []),
              { label: 'GRR', sigma: grr, pct: grrPct != null ? `${grrPct.toFixed(1)}` : '—' },
              { label: 'Part Variation (PV)', sigma: pv, pct: tv && tv > 0 && pv != null ? ((pv / tv) * 100).toFixed(1) : '—' },
              { label: 'Total Variation (TV)', sigma: tv, pct: '100', bold: true },
            ].map(row => (
              <tr key={row.label} style={{ borderBottom: '1px solid var(--line-1)' }}>
                <td style={{ padding: '0.375rem 0' }}>{row.bold ? <strong>{row.label}</strong> : row.label}</td>
                <td style={{ textAlign: 'right', padding: '0.375rem 0', fontVariantNumeric: 'tabular-nums' }}>{row.bold ? <strong>{row.sigma?.toFixed(4)}</strong> : row.sigma?.toFixed(4)}</td>
                <td style={{ textAlign: 'right', padding: '0.375rem 0' }}>{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
          NDC (Number of Distinct Categories): <strong style={{ color: 'var(--text-1)' }}>{ndc ?? '—'}</strong>
          {ndc != null && ndc < 5 && (
            <span style={{ color: 'var(--status-warn)' }}> ⚠ NDC &lt; 5 — gauge cannot discriminate between parts</span>
          )}
        </p>

        <button
          className="btn btn-primary"
          type="button"
          onClick={() => { void onSave() }}
          disabled={saving || !isPersistable}
          style={{ width: 'fit-content' }}
        >
          {saving ? 'Saving…' : 'Save Session'}
        </button>
      </div>
    </div>
  )
}

function generateSampleData(nOp: number, nPt: number, nRep: number): string {
  const rows: string[] = []
  const base = 10.0
  const noise = 0.15
  const rnd = (op: number, pt: number, rep: number) => {
    const x = Math.sin(op * 127 + pt * 31 + rep * 7) * 43758.5453
    return (x - Math.floor(x)) * 2 - 1
  }
  for (let op = 1; op <= nOp; op++) {
    for (let pt = 1; pt <= nPt; pt++) {
      const partOffset = rnd(0, pt, 0) * 0.5
      for (let rep = 1; rep <= nRep; rep++) {
        const val = (base + partOffset + rnd(op, pt, rep) * noise).toFixed(3)
        rows.push(`${op},${pt},${rep},${val}`)
      }
    }
  }
  return rows.join('\n')
}

const STEP_STYLE = {
  num: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: 'var(--valentia-slate)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 } as const,
  li: { display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-3)' } as const,
}

export default function MSAView() {
  const state = useSPCSelector(
    current => ({
      selectedMaterial: current.selectedMaterial,
      selectedMIC: current.selectedMIC,
    }),
    shallowEqual,
  )
  const [method, setMethod] = useState<'average_range' | 'anova'>('average_range')
  const [nOperators, setNOperators] = useState(3)
  const [nParts, setNParts] = useState(10)
  const [nReplicates, setNReplicates] = useState(2)
  const [tolerance, setTolerance] = useState('')
  const [csvText, setCsvText] = useState<string>(() => generateSampleData(3, 10, 2))
  const [result, setResult] = useState<MSAResult | null>(null)
  const { calculating, error: calculationError, runCalculation } = useMSACalculate()
  const { saving, error: saveError, save } = useMSASave()

  const isPersistable = !!result && !result?.error && !!state.selectedMaterial && !!state.selectedMIC

  const handleCalculate = async () => {
    const data = parseCSVData(csvText, nOperators, nParts, nReplicates)
    if (!data) {
      setResult({ error: 'Could not parse data. Expected format: operator,part,replicate,value (one row per measurement).' })
      return
    }
    const tol = parseFloat(tolerance) || 0
    const nextResult = await runCalculation(data, tol, method)
    setResult(nextResult as MSAResult)
  }

  const handleSave = async () => {
    if (!result || result.error || !state.selectedMaterial || !state.selectedMIC) return
    await save({
      material_id: state.selectedMaterial.material_id,
      mic_id: state.selectedMIC.mic_id,
      n_operators: nOperators,
      n_parts: nParts,
      n_replicates: nReplicates,
      grr_pct: result.grrPct ?? 0,
      repeatability: result.repeatability ?? 0,
      reproducibility: result.reproducibility ?? 0,
      ndc: result.ndc ?? 0,
      results_json: JSON.stringify(result),
    })
  }

  const inputStyle: React.CSSProperties = { height: '2rem', width: '6rem', border: '1px solid var(--line-2)', background: 'var(--surface-1)', color: 'var(--text-1)', padding: '0 0.75rem', fontSize: '0.875rem', borderRadius: 6, outline: 'none' }
  const tile: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1.25rem' }
  const eyebrow: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={tile}>
        <div style={{ marginBottom: '0.25rem', ...eyebrow }}>Measurement system validation</div>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)' }}>Gauge R&amp;R</h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-3)' }}>
          Assess whether the measurement system can reliably distinguish part-to-part variation from
          gauge noise (repeatability and reproducibility).
        </p>
      </div>

      {/* Getting started guidance */}
      <div style={tile}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={eyebrow}>Getting started</div>
          <ol style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              <>Select a characteristic in the <strong>Charts</strong> tab to associate the study with a specific MIC.</>,
              <>Set the study parameters below: how many operators, representative parts, and replicates.</>,
              <>Collect measurements: each operator measures each part the required number of times.</>,
              <>Enter the data in the table below and press <strong>Calculate GRR</strong>.</>,
            ].map((text, i) => (
              <li key={i} style={STEP_STYLE.li}>
                <span style={STEP_STYLE.num}>{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* MIC association warning */}
      {!state.selectedMIC && (
        <InfoBanner variant="warn">
          No characteristic selected. Go to the Charts tab, select a MIC, then return here to associate this study with that characteristic. Results can still be calculated without this link, but cannot be saved to the audit trail.
        </InfoBanner>
      )}

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0, 1.5fr) 320px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Study setup */}
          <div style={tile}>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Study parameters</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-1)' }}>Method:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }} role="group" aria-label="GRR calculation method">
                    <button
                      className={method === 'average_range' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                      type="button"
                      onClick={() => setMethod('average_range')}
                      aria-pressed={method === 'average_range'}
                    >
                      Average &amp; Range
                    </button>
                    <button
                      className={method === 'anova' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                      type="button"
                      onClick={() => setMethod('anova')}
                      aria-pressed={method === 'anova'}
                    >
                      ANOVA
                    </button>
                  </div>
                </div>
                <FieldHelp>
                  Average &amp; Range is simpler and widely accepted. Use ANOVA when you have ≥ 3 replicates and
                  want to detect operator-by-part interaction effects.
                </FieldHelp>

                {[
                  { id: 'msa-operators', label: 'Operators:', value: nOperators, min: 2, max: 5, helpId: 'msa-operators-help', help: '2–5. Typically 3 operators for a standard study.', onChange: (v: number) => setNOperators(Math.max(2, Math.min(5, v))) },
                  { id: 'msa-parts', label: 'Parts:', value: nParts, min: 2, max: 10, helpId: 'msa-parts-help', help: '2–10. Use 10 parts spanning the expected production range (not just good parts).', onChange: (v: number) => setNParts(Math.max(2, Math.min(10, v))) },
                  { id: 'msa-replicates', label: 'Replicates:', value: nReplicates, min: 2, max: 5, helpId: 'msa-replicates-help', help: '2–5. Each operator measures each part this many times (blind, random order).', onChange: (v: number) => setNReplicates(Math.max(2, Math.min(5, v))) },
                ].map(({ id, label, value, min, max, helpId, help, onChange }) => (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <label htmlFor={id} style={{ fontSize: '0.875rem', color: 'var(--text-1)' }}>{label}</label>
                      <input
                        id={id}
                        type="number"
                        style={inputStyle}
                        min={min}
                        max={max}
                        value={value}
                        aria-describedby={helpId}
                        onChange={e => onChange(Number(e.target.value))}
                      />
                    </div>
                    <FieldHelp id={helpId}>{help}</FieldHelp>
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <label htmlFor="msa-tolerance" style={{ fontSize: '0.875rem', color: 'var(--text-1)' }}>Tolerance (USL−LSL):</label>
                    <input
                      id="msa-tolerance"
                      type="number"
                      style={{ ...inputStyle, width: '8rem' }}
                      step="any"
                      value={tolerance}
                      aria-describedby="msa-tolerance-help"
                      onChange={e => setTolerance(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <FieldHelp id="msa-tolerance-help">
                    Optional. If provided, % GRR of tolerance is calculated in addition to % of total variation.
                  </FieldHelp>
                </div>
              </div>
            </fieldset>
          </div>

          {/* Data entry */}
          <div style={tile}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-1)' }} htmlFor="msa-data">
                  Measurement data
                </label>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setCsvText(generateSampleData(nOperators, nParts, nReplicates))}
                >
                  Fill sample data
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>
                One measurement per line. Columns: <code style={{ background: 'var(--surface-sunken)', padding: '0 0.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>operator, part, replicate, value</code>
              </p>
              <pre style={{ margin: 0, overflowX: 'auto', border: '1px solid var(--line-1)', background: 'var(--surface-sunken)', padding: '0.5rem 0.75rem', fontSize: '0.7rem', lineHeight: 1.6, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', borderRadius: 4 }}>{`1,1,1,10.25\n1,1,2,10.30\n1,2,1,10.52\n1,2,2,10.48\n2,1,1,10.21  ← operator 2, part 1, replicate 1\n2,1,2,10.27\n…`}</pre>
              <textarea
                id="msa-data"
                className="field"
                rows={10}
                value={csvText}
                aria-label="Measurement data in CSV format: operator, part, replicate, value"
                onChange={e => setCsvText(e.target.value)}
                style={{ height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="button"
            onClick={() => { void handleCalculate() }}
            disabled={calculating}
            style={{ width: 'fit-content' }}
          >
            {calculating ? 'Calculating…' : 'Calculate GRR'}
          </button>
        </div>

        {/* Interpretation guide */}
        <div style={tile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={eyebrow}>Interpretation guide</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
              GRR tells you what fraction of your observed variation comes from the measurement system itself
              rather than genuine part-to-part differences.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ border: '1px solid var(--status-ok)', background: 'var(--status-ok-bg)', padding: '0.625rem', borderRadius: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-1)' }}>✓ &lt; 10% GRR</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>Acceptable. Gauge is suitable for production use.</p>
              </div>
              <div style={{ border: '1px solid var(--status-warn)', background: 'var(--status-warn-bg)', padding: '0.625rem', borderRadius: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-1)' }}>⚠ 10–30% GRR</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>Conditionally acceptable. May be OK depending on process risk and context.</p>
              </div>
              <div style={{ border: '1px solid var(--status-risk)', background: 'var(--status-risk-bg)', padding: '0.625rem', borderRadius: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-1)' }}>✕ &gt; 30% GRR</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>Not acceptable. The measurement system is a major source of variability.</p>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-1)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-1)' }}>NDC (Number of Distinct Categories)</p>
              <p style={{ margin: '0.25rem 0 0' }}>NDC ≥ 5 means the gauge can resolve at least 5 distinct levels of part quality. If NDC &lt; 5, the system cannot reliably classify parts.</p>
            </div>
          </div>
        </div>
      </div>

      {calculationError && <InfoBanner variant="warn">{calculationError}</InfoBanner>}
      {saveError && <InfoBanner variant="error">{saveError}</InfoBanner>}
      <GRRResult result={result} onSave={handleSave} saving={saving} isPersistable={isPersistable} />
    </div>
  )
}
